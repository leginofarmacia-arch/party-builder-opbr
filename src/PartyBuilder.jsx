import React, { useEffect, useMemo, useState } from "react";
import charactersData from "./data/characters.json";

/* =============================
   CONFIG
============================= */
const PARTY_COUNT = 10;
const SUPPORT_SLOTS = 10;
const STORAGE_KEY = "opbr_party_builder_ui";

/* =============================
   HELPERS
============================= */
function formatName(n) {
  return String(n || "").replace(/\n/g, " ");
}

function getPrimaryColor(char) {
  return (char?.primaryColor || char?.color || "").trim();
}

function getPrimaryRole(char) {
  if (!char) return "";
  if (typeof char.role === "string") return char.role;
  if (Array.isArray(char.role) && char.role.length) return char.role[0];
  if (Array.isArray(char.roles) && char.roles.length) return char.roles[0];
  return "";
}

function roleLetter(role) {
  const r = String(role || "").toLowerCase();
  if (r.startsWith("att")) return "A";
  if (r.startsWith("run")) return "R";
  if (r.startsWith("def")) return "D";
  return "";
}

function colorDotClass(color) {
  const c = String(color || "").toLowerCase().trim();
  if (c === "red") return "bg-red-500";
  if (c === "blue") return "bg-blue-500";
  if (c === "green") return "bg-green-500";
  if (c === "dark" || c === "black") return "bg-neutral-900";
  if (c === "light" || c === "white") return "bg-neutral-100";
  return "bg-gray-400";
}

function normalizeCharacterKey(name) {
  const raw = String(name || "");
  const lastLine =
    raw
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .pop() || raw.trim();

  return lastLine
    .toLowerCase()
    .replace(/['".,()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/* =============================
   TAG ENGINE
============================= */
const EXCLUDED_TAGS = new Set([
  "",
  "Power users",
  "Power user(s)",
  "Long-Range Normal Attacks",
  "Long-range normal attack",
  "Long-range normal attacks",
  "Long-Range Normal Attack",
]);

const TAG_ALIASES = {
  "Kozuki Clan": "Kozuki Clan/Kozuki Clan Servant",
  "Kozuki Clan Servant": "Kozuki Clan/Kozuki Clan Servant",
  "Roger Pirates": "Roger Pirates/Ex-Roger Pirates",
  "Ex-Roger Pirates": "Roger Pirates/Ex-Roger Pirates",
  "Baroque Works": "Baroque Works/Former Baroque Works",
  "Former Baroque Works": "Baroque Works/Former Baroque Works",
  "Navy Admiral": "Navy Admiral/Former Navy Admiral",
  "Former Navy Admiral": "Navy Admiral/Former Navy Admiral",
  "Royalty": "Royalty/Former Royalty",
  "Former Royalty": "Royalty/Former Royalty",
  "The Seven warlords of the Sea":
    "The Seven Warlords of the Sea/Former Warlords of the Sea",
  "The Seven Warlords of the Sea":
    "The Seven Warlords of the Sea/Former Warlords of the Sea",
  "Former Warlords of the Sea":
    "The Seven Warlords of the Sea/Former Warlords of the Sea",
};

function canonicalizeTag(tag) {
  const t = String(tag || "").trim();
  if (!t) return "";
  if (EXCLUDED_TAGS.has(t)) return "";
  return TAG_ALIASES[t] || t;
}

function tagLevelFromCount(count) {
  if (count >= 6) return 5;
  if (count >= 5) return 4;
  if (count >= 4) return 3;
  if (count >= 2) return 2;
  if (count >= 1) return 1;
  return 0;
}

function nextThreshold(count) {
  if (count >= 6) return null;
  if (count >= 5) return 6;
  if (count >= 4) return 5;
  if (count >= 2) return 4;
  if (count >= 1) return 2;
  return 1;
}

/* =============================
   STORAGE
============================= */
function emptyParty() {
  return {
    active1: null,
    active2: null,
    support: Array.from({ length: SUPPORT_SLOTS }, () => null),
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        partyIndex: 0,
        mode: "active1",
        search: "",
        parties: Array.from({ length: PARTY_COUNT }, emptyParty),
        rosterFilters: { color: "All", role: "All" },
      };
    }
    const parsed = JSON.parse(raw);

    if (!parsed.parties || !Array.isArray(parsed.parties)) throw new Error("bad");
    if (parsed.parties.length !== PARTY_COUNT) throw new Error("bad");

    parsed.parties = parsed.parties.map((p) => ({
      ...emptyParty(),
      ...p,
      support:
        Array.isArray(p?.support) && p.support.length === SUPPORT_SLOTS
          ? p.support.map((x) => x || null)
          : emptyParty().support,
    }));

    if (!parsed.rosterFilters) parsed.rosterFilters = { color: "All", role: "All" };
    if (!parsed.rosterFilters.color) parsed.rosterFilters.color = "All";
    if (!parsed.rosterFilters.role) parsed.rosterFilters.role = "All";

    if (!parsed.mode) parsed.mode = "active1";
    if (typeof parsed.search !== "string") parsed.search = "";

    return parsed;
  } catch {
    return {
      partyIndex: 0,
      mode: "active1",
      search: "",
      parties: Array.from({ length: PARTY_COUNT }, emptyParty),
      rosterFilters: { color: "All", role: "All" },
    };
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("saveState failed", e);
  }
}

/* =============================
   DND PAYLOAD
============================= */
function makePayload(obj) {
  return JSON.stringify(obj);
}
function readPayload(str) {
  try {
    const obj = JSON.parse(str);
    return obj && typeof obj === "object" ? obj : null;
  } catch {
    return null;
  }
}

/* =============================
   UI COMPONENTS
============================= */

function MiniOverlay({ char }) {
  if (!char) return null;
  const col = getPrimaryColor(char);
  const role = getPrimaryRole(char);
  const letter = roleLetter(role);
  const isLight = ["light", "white"].includes(String(col || "").toLowerCase().trim());

  return (
    <div className="absolute bottom-1 left-1 flex items-center gap-1">
      <div className={`w-3 h-3 rounded-full ${colorDotClass(col)} border border-black/50`} />
      <div
        className={`text-[8px] px-1 rounded border border-white/10 ${
          isLight ? "bg-white/70 text-black" : "bg-black/60 text-white"
        }`}
      >
        {letter}
      </div>
    </div>
  );
}

function Frame({ selected, highlight, children, className = "" }) {
  const sel = selected
    ? "shadow-[0_0_0_2px_rgba(255,255,255,0.65),0_0_18px_rgba(255,255,255,0.12)]"
    : "";
  const hi =
    !selected && highlight
      ? "shadow-[0_0_0_2px_rgba(250,204,21,0.75),0_0_18px_rgba(250,204,21,0.25)]"
      : "";

  return (
    <div
      className={[
        "relative rounded overflow-hidden",
        "border border-black/80",
        "bg-gradient-to-b from-[#3b4048] to-[#23272d]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.45)]",
        sel,
        hi,
        className,
      ].join(" ")}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-white/10" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-black/35" />
      {children}
    </div>
  );
}

function SupportBonusBar({ partyColor, filled, total = 10, bonusPercent }) {
  const c = String(partyColor || "").trim();
  const disabled = !c;

  return (
    <Frame selected={false} highlight={false} className="p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-[190px]">
          <div className="text-xs text-white/70 font-semibold">Support</div>
          <div className="flex items-center gap-2 mt-1">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                disabled ? "bg-gray-500" : colorDotClass(c)
              } border border-black/60`}
            />
            <div className="text-sm font-extrabold tracking-wide">{c || "—"}</div>
            <div className="text-xs text-white/60">
              {filled}/{total}
            </div>
          </div>
        </div>

        <div className="flex-1">
          <div className={`grid grid-cols-10 gap-1 ${disabled ? "opacity-60" : ""}`}>
            {Array.from({ length: total }).map((_, i) => {
              const on = i < filled && !disabled;
              return (
                <div
                  key={i}
                  className={`h-3 rounded-sm border ${
                    on ? `${colorDotClass(c)} border-black/80` : "bg-[#2a2f36] border-black/80"
                  } shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`}
                />
              );
            })}
          </div>
          <div className="text-[10px] text-white/55 mt-1">
            Same primary color support fills the bar.
          </div>
        </div>

        <div className="text-right min-w-[90px]">
          <div className="text-xs text-white/70 font-semibold">Bonus</div>
          <div className={`text-lg font-extrabold leading-none ${disabled ? "text-white/40" : ""}`}>
            {disabled ? "—" : `${bonusPercent}%`}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function ActiveCard({
  title,
  char,
  selected,
  highlight,
  onClick,
  onDropPayload,
  onDragStartPayload,
  onDragEnd,
}) {
  const name = char ? formatName(char.name) : "EMPTY";
  const role = getPrimaryRole(char);
  const col = getPrimaryColor(char);

  return (
    <Frame selected={selected} highlight={highlight} className="cursor-pointer w-full">
      <div
        className="relative w-full"
        onClick={onClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const payload = readPayload(e.dataTransfer.getData("text/plain"));
          onDropPayload(payload);
        }}
        draggable={!!char}
        onDragStart={(e) => {
          if (!char) return;
          const p = onDragStartPayload();
          e.dataTransfer.setData("text/plain", makePayload(p));
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={onDragEnd}
        role="button"
        tabIndex={0}
      >
        {selected ? (
          <div className="absolute top-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-white text-black font-bold z-10">
            SELECTED
          </div>
        ) : null}

        <div className="bg-gradient-to-b from-[#f1a33a] to-[#d77f14] text-black text-xs px-2 py-1 font-extrabold flex justify-between">
          <span>{title}</span>
          <span className="text-[11px] font-bold">{char ? "Lv.100" : ""}</span>
        </div>

        <div className="p-2">
          <div className="h-[128px] bg-[#40464e] relative flex items-center justify-center text-white/60 text-xs border border-black/60 rounded">
            {char ? "NO ICON" : "EMPTY"}
            <MiniOverlay char={char} />
          </div>

          <div className="mt-2 text-sm font-extrabold leading-tight">{name}</div>

          <div className="text-xs text-white/70 mt-1">
            {role || "—"} • {col || "—"}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function SupportTile({
  char,
  selected,
  highlight,
  onClick,
  onDropPayload,
  onDragStartPayload,
  onDragEnd,
}) {
  const name = char ? formatName(char.name) : "";

  return (
    <Frame selected={selected} highlight={highlight} className="cursor-pointer w-full">
      <div
        onClick={onClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const payload = readPayload(e.dataTransfer.getData("text/plain"));
          onDropPayload(payload);
        }}
        draggable={!!char}
        onDragStart={(e) => {
          if (!char) return;
          const p = onDragStartPayload();
          e.dataTransfer.setData("text/plain", makePayload(p));
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={onDragEnd}
        title={name || "Empty"}
        role="button"
        tabIndex={0}
      >
        <div className="h-[86px] bg-[#40464e] relative flex items-center justify-center text-white/60 text-[10px] border-b border-black/60">
          {char ? "NO ICON" : "+"}
          <MiniOverlay char={char} />
        </div>

        <div className="text-[10px] px-1.5 py-1 line-clamp-2 text-white/75 min-h-[36px]">
          {name}
        </div>
      </div>
    </Frame>
  );
}

function RosterTile({ char, selected, disabled, onClick, onDragStart, onDragEnd }) {
  const name = formatName(char.name);

  return (
    <div
      draggable={!disabled}
      onDragStart={(e) => {
        if (disabled) return;
        const p = { type: "roster", id: String(char.id) };
        e.dataTransfer.setData("text/plain", makePayload(p));
        e.dataTransfer.effectAllowed = "copy";
        onDragStart?.(p);
      }}
      onDragEnd={onDragEnd}
      onClick={() => {
        if (disabled) return;
        onClick();
      }}
      className={[
        "rounded overflow-hidden border cursor-pointer",
        selected ? "border-white" : "border-black/80",
        "bg-gradient-to-b from-[#3b4048] to-[#23272d]",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        disabled ? "opacity-35 grayscale cursor-not-allowed" : "hover:brightness-110",
      ].join(" ")}
      title={disabled ? `${name} (not usable for selected slot)` : name}
      role="button"
      tabIndex={0}
    >
      <div className="h-20 bg-[#40464e] relative flex items-center justify-center text-white/60 text-[10px] border-b border-black/60">
        NO ICON
        <MiniOverlay char={char} />
      </div>

      <div className="px-1 py-1">
        <div className="text-[10px] font-semibold leading-tight line-clamp-2">{name}</div>
        <div className="text-[9px] text-white/60 mt-0.5">
          {getPrimaryRole(char) || "—"} • {getPrimaryColor(char) || "—"}
        </div>
      </div>
    </div>
  );
}

function QuickButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded border ${
        active ? "border-white bg-black/40" : "border-white/20 bg-black/20 hover:bg-black/30"
      }`}
    >
      {children}
    </button>
  );
}

/* =============================
   MAIN
============================= */
export default function PartyBuilder() {
  const [state, setState] = useState(loadState());
  const [dragging, setDragging] = useState(null);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const { partyIndex, mode, search, parties, rosterFilters } = state;
  const party = parties[partyIndex] || emptyParty();

  const roster = Array.isArray(charactersData) ? charactersData : [];
  const rosterById = useMemo(() => {
    const m = new Map();
    for (const c of roster) m.set(String(c.id), c);
    return m;
  }, [roster]);

  const active1 = party.active1;
  const active2 = party.active2;
  const support = Array.isArray(party.support)
    ? party.support
    : Array.from({ length: SUPPORT_SLOTS }, () => null);

  const activeKey1 = useMemo(() => normalizeCharacterKey(active1?.name), [active1]);
  const activeKey2 = useMemo(() => normalizeCharacterKey(active2?.name), [active2]);

  const partyColor = getPrimaryColor(active1) || getPrimaryColor(active2) || "";
  const sameColorCount = support.filter((s) => s && getPrimaryColor(s) === partyColor).length;
  const bonus = partyColor ? sameColorCount * 10 : 0;

  const totalPower = useMemo(() => {
    const a1 = active1?.power || 0;
    const a2 = active2?.power || 0;
    const sup = support.reduce((sum, c) => sum + (c?.power || 0), 0);
    return a1 + a2 + sup;
  }, [active1, active2, support]);

  const supportTagLevels = useMemo(() => {
    const counts = new Map();
    support.forEach((char) => {
      if (!char || !Array.isArray(char.tags)) return;
      const perChar = new Set();
      char.tags.forEach((t) => {
        const canon = canonicalizeTag(t);
        if (!canon) return;
        perChar.add(canon);
      });
      for (const canon of perChar) counts.set(canon, (counts.get(canon) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([tag, count]) => ({
        tag,
        count,
        level: tagLevelFromCount(count),
        next: nextThreshold(count),
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  }, [support]);

  function updateParty(patch) {
    const newParties = [...parties];
    newParties[partyIndex] = { ...party, ...patch };
    setState({ ...state, parties: newParties });
  }

  function sanitizeParty(nextParty) {
    const seen = new Set();
    const sup = (nextParty.support || []).map((s) => {
      if (!s) return null;
      const id = String(s.id);
      if (seen.has(id)) return null;
      seen.add(id);
      return s;
    });

    const a1id = nextParty.active1 ? String(nextParty.active1.id) : null;
    const a2id = nextParty.active2 ? String(nextParty.active2.id) : null;

    const cleaned = sup.map((s) => {
      if (!s) return null;
      const sid = String(s.id);
      if (a1id && sid === a1id) return null;
      if (a2id && sid === a2id) return null;
      return s;
    });

    return { ...nextParty, support: cleaned };
  }

  function applyParty(nextParty) {
    updateParty(sanitizeParty(nextParty));
  }

  function wouldBreakActiveBaseRule(nextA1, nextA2) {
    const k1 = normalizeCharacterKey(nextA1?.name);
    const k2 = normalizeCharacterKey(nextA2?.name);
    if (!k1 || !k2) return false;
    return k1 === k2;
  }

  function canUseForSelectedSlot(char) {
    if (!char) return false;

    const id = String(char.id);

    if (mode.startsWith("support-")) {
      if (active1 && String(active1.id) === id) return false;
      if (active2 && String(active2.id) === id) return false;

      const idx = Number(mode.split("-")[1]);
      const already = support.some((s, i) => s && String(s.id) === id && i !== idx);
      if (already) return false;

      return true;
    }

    if (mode === "active1") {
      const candKey = normalizeCharacterKey(char.name);
      if (activeKey2 && candKey === activeKey2) return false;
      return true;
    }

    if (mode === "active2") {
      const candKey = normalizeCharacterKey(char.name);
      if (activeKey1 && candKey === activeKey1) return false;
      return true;
    }

    return true;
  }

  function isValidDropToActive(slot, payload) {
    if (!payload) return false;

    if (payload.type === "roster") {
      const incoming = rosterById.get(String(payload.id));
      if (!incoming) return false;

      const nextA1 = slot === 1 ? incoming : active1;
      const nextA2 = slot === 2 ? incoming : active2;
      if (wouldBreakActiveBaseRule(nextA1, nextA2)) return false;

      return true;
    }

    if (payload.type === "active") {
      if (payload.slot === slot) return false;
      const swappedA1 = payload.slot === 2 ? active2 : active1;
      const swappedA2 = payload.slot === 1 ? active1 : active2;
      if (wouldBreakActiveBaseRule(swappedA1, swappedA2)) return false;
      return true;
    }

    if (payload.type === "support") {
      const incoming = support[payload.index];
      if (!incoming) return false;

      const nextA1 = slot === 1 ? incoming : active1;
      const nextA2 = slot === 2 ? incoming : active2;
      if (wouldBreakActiveBaseRule(nextA1, nextA2)) return false;

      return true;
    }

    return false;
  }

  function isValidDropToSupport(index, payload) {
    if (!payload) return false;

    if (payload.type === "roster") {
      const incoming = rosterById.get(String(payload.id));
      if (!incoming) return false;
      if (active1 && String(active1.id) === String(incoming.id)) return false;
      if (active2 && String(active2.id) === String(incoming.id)) return false;

      const already = support.some((s, i) => s && String(s.id) === String(incoming.id) && i !== index);
      if (already) return false;

      return true;
    }

    if (payload.type === "support") {
      if (payload.index === index) return false;
      return true;
    }

    if (payload.type === "active") {
      const incoming = payload.slot === 1 ? active1 : active2;
      if (!incoming) return false;

      const targetSupport = support[index];
      const nextA1 = payload.slot === 1 ? targetSupport : active1;
      const nextA2 = payload.slot === 2 ? targetSupport : active2;
      if (wouldBreakActiveBaseRule(nextA1, nextA2)) return false;

      return true;
    }

    return false;
  }

  function handleDropToActive(slot, payload) {
    if (!payload) return;

    const next = { ...party, support: [...support] };
    const targetKey = slot === 1 ? "active1" : "active2";

    if (payload.type === "roster") {
      const incoming = rosterById.get(String(payload.id));
      if (!incoming) return;

      const nextA1 = slot === 1 ? incoming : next.active1;
      const nextA2 = slot === 2 ? incoming : next.active2;
      if (wouldBreakActiveBaseRule(nextA1, nextA2)) return;

      next[targetKey] = incoming;
      applyParty(next);
      return;
    }

  if (payload.type === "active") {
  const fromSlot = payload.slot;
  if (fromSlot === slot) return;

  // SWAP semplice tra active1 e active2
  const a1 = next.active1 || null;
  const a2 = next.active2 || null;

  next.active1 = a2;
  next.active2 = a1;

  // sicurezza (in teoria non serve, ma la teniamo)
  if (wouldBreakActiveBaseRule(next.active1, next.active2)) {
    next.active1 = a1;
    next.active2 = a2;
    return;
  }

  applyParty(next);
  return;
}

    if (payload.type === "support") {
      const fromIndex = payload.index;
      const incoming = next.support[fromIndex];
      if (!incoming) return;

      const targetActive = next[targetKey];

      const nextA1 = slot === 1 ? incoming : next.active1;
      const nextA2 = slot === 2 ? incoming : next.active2;
      if (wouldBreakActiveBaseRule(nextA1, nextA2)) return;

      next[targetKey] = incoming;
      next.support[fromIndex] = targetActive || null;
      applyParty(next);
      return;
    }
  }

  function handleDropToSupport(index, payload) {
    if (!payload) return;

    const next = { ...party, support: [...support] };

    if (payload.type === "roster") {
      const incoming = rosterById.get(String(payload.id));
      if (!incoming) return;

      if (next.active1 && String(next.active1.id) === String(incoming.id)) return;
      if (next.active2 && String(next.active2.id) === String(incoming.id)) return;

      const already = next.support.some((s, i) => s && String(s.id) === String(incoming.id) && i !== index);
      if (already) return;

      next.support[index] = incoming;
      applyParty(next);
      return;
    }

    if (payload.type === "support") {
      const fromIndex = payload.index;
      if (fromIndex === index) return;

      const a = next.support[fromIndex];
      const b = next.support[index];
      next.support[index] = a || null;
      next.support[fromIndex] = b || null;
      applyParty(next);
      return;
    }

    if (payload.type === "active") {
      const fromSlot = payload.slot;
      const fromKey = fromSlot === 1 ? "active1" : "active2";
      const incoming = next[fromKey];
      if (!incoming) return;

      const already = next.support.some((s, i) => s && String(s.id) === String(incoming.id) && i !== index);
      if (already) return;

      const targetSupport = next.support[index];

      const nextA1 = fromSlot === 1 ? targetSupport : next.active1;
      const nextA2 = fromSlot === 2 ? targetSupport : next.active2;
      if (wouldBreakActiveBaseRule(nextA1, nextA2)) return;

      next.support[index] = incoming;
      next[fromKey] = targetSupport || null;
      applyParty(next);
      return;
    }
  }

  function assignCharByClick(char) {
    if (!char) return;
    if (!canUseForSelectedSlot(char)) return;

    const next = { ...party, support: [...support] };

    if (mode === "active1") {
      if (wouldBreakActiveBaseRule(char, next.active2)) return;
      next.active1 = char;
      applyParty(next);
      return;
    }

    if (mode === "active2") {
      if (wouldBreakActiveBaseRule(next.active1, char)) return;
      next.active2 = char;
      applyParty(next);
      return;
    }

    if (mode.startsWith("support-")) {
      const idx = Number(mode.split("-")[1]);
      if (Number.isNaN(idx)) return;
      next.support[idx] = char;
      applyParty(next);
    }
  }

  const selectedColor = rosterFilters?.color || "All";
  const selectedRole = rosterFilters?.role || "All";

  function setRosterFilters(patch) {
    setState({ ...state, rosterFilters: { ...state.rosterFilters, ...patch } });
  }

  function matchesColorFilter(charColor, filterColor) {
    if (filterColor === "All") return true;

    const c = String(charColor || "").toLowerCase().trim();
    if (filterColor === "Red") return c === "red";
    if (filterColor === "Blue") return c === "blue";
    if (filterColor === "Green") return c === "green";
    if (filterColor === "Dark") return c === "dark" || c === "black";
    if (filterColor === "Light") return c === "light" || c === "white";
    return false;
  }

  const filteredRoster = useMemo(() => {
    const q = search.trim().toLowerCase();

    return roster.filter((c) => {
      if (!matchesColorFilter(getPrimaryColor(c), selectedColor)) return false;

      if (selectedRole !== "All") {
        if (String(getPrimaryRole(c)) !== selectedRole) return false;
      }

      if (!q) return true;

      const name = formatName(c.name).toLowerCase();
      if (name.includes(q)) return true;

      const role = String(getPrimaryRole(c) || "").toLowerCase();
      if (role.includes(q)) return true;

      const col = String(getPrimaryColor(c) || "").toLowerCase();
      if (col.includes(q)) return true;

      const tags = Array.isArray(c.tags) ? c.tags : [];
      return tags.some((t) => String(t || "").toLowerCase().includes(q));
    });
  }, [roster, search, selectedColor, selectedRole]);

  const dragPayload = dragging;
  const active1Highlight = isValidDropToActive(1, dragPayload);
  const active2Highlight = isValidDropToActive(2, dragPayload);
  const supportHighlights = support.map((_, i) => isValidDropToSupport(i, dragPayload));

  const selectedHint = useMemo(() => {
    if (mode === "active1")
      return "Select Active 1: roster shows only valid picks (no duplicate base with Active 2).";
    if (mode === "active2")
      return "Select Active 2: roster shows only valid picks (no duplicate base with Active 1).";
    if (mode.startsWith("support-")) return "Select Support slot: roster disables actives + duplicates.";
    return "";
  }, [mode]);

  return (
    <div className="min-h-screen bg-[#1f2328] text-white">
      {/* TOP BAR */}
      <div className="border-b border-black/80 bg-black/35">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex items-center gap-3">
            <div className="text-sm font-extrabold tracking-wide">PARTY BUILDER OPBR (WEB)</div>

            <div className="flex gap-1 flex-wrap">
              {Array.from({ length: PARTY_COUNT }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setState({ ...state, partyIndex: i })}
                  className={`px-2 py-1 text-xs border rounded ${
                    i === partyIndex
                      ? "border-white bg-[#2b2f35]"
                      : "border-white/25 bg-[#2b2f35]/40 hover:bg-[#2b2f35]/60"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="text-xs text-white/70">
            Total Party Power: <span className="font-semibold">{totalPower}</span>
          </div>
        </div>
      </div>

      {/* MAIN */}
      <div className="mx-auto max-w-[1480px] px-3 py-3">
        {/* ✅ ROSTER SEMPRE A DESTRA: layout fisso 2 colonne */}
        <div className="grid grid-cols-[520px_minmax(0,1fr)] gap-3">
          {/* LEFT = PARTY */}
          <div className="space-y-3 min-w-0">
            <SupportBonusBar partyColor={partyColor} filled={sameColorCount} total={10} bonusPercent={bonus} />

            {/* Active: responsive dentro 520 (niente width fisse) */}
            <div className="grid grid-cols-2 gap-2">
              <ActiveCard
                title="Battle Character 1"
                char={active1}
                selected={mode === "active1"}
                highlight={dragPayload ? active1Highlight : false}
                onClick={() => setState({ ...state, mode: "active1" })}
                onDropPayload={(payload) => {
  handleDropToActive(1, payload || dragging);
  setDragging(null);
}}
                onDragStartPayload={() => {
                  const p = { type: "active", slot: 1 };
                  setDragging(p);
                  return p;
                }}
                onDragEnd={() => setDragging(null)}
              />

              <ActiveCard
                title="Battle Character 2"
                char={active2}
                selected={mode === "active2"}
                highlight={dragPayload ? active2Highlight : false}
                onClick={() => setState({ ...state, mode: "active2" })}
              onDropPayload={(payload) => {
  handleDropToActive(2, payload || dragging);
  setDragging(null);
}}
                onDragStartPayload={() => {
                  const p = { type: "active", slot: 2 };
                  setDragging(p);
                  return p;
                }}
                onDragEnd={() => setDragging(null)}
              />
            </div>

            <Frame selected={false} highlight={false} className="p-2">
              <div className="flex items-center justify-between">
                <div className="px-2 py-1 text-xs rounded bg-gradient-to-b from-[#f1a33a] to-[#d77f14] text-black font-extrabold">
                  Support Character
                </div>
                <div className="text-xs text-white/60">{selectedHint}</div>
              </div>

              {/* ✅ resta 10 slot, ma si adatta al 520 senza sforare */}
              <div
                className="mt-2 grid gap-2"
                style={{ gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))" }}
              >
                {support.map((s, i) => (
                  <SupportTile
                    key={i}
                    char={s}
                    selected={mode === `support-${i}`}
                    highlight={dragPayload ? supportHighlights[i] : false}
                    onClick={() => setState({ ...state, mode: `support-${i}` })}
                    onDropPayload={(payload) => {
                      handleDropToSupport(i, payload);
                      setDragging(null);
                    }}
                    onDragStartPayload={() => {
                      const p = { type: "support", index: i };
                      setDragging(p);
                      return p;
                    }}
                    onDragEnd={() => setDragging(null)}
                  />
                ))}
              </div>
            </Frame>

            <Frame selected={false} highlight={false} className="p-2">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-extrabold">Support Tags</div>
                <div className="text-xs text-white/70">
                  Active: <span className="font-semibold">{supportTagLevels.length}</span>
                </div>
              </div>

              <div className="max-h-[230px] overflow-auto space-y-1 pr-1">
                {supportTagLevels.length === 0 && <div className="text-xs text-white/50">No tags active</div>}
                {supportTagLevels.map(({ tag, count, level, next }) => (
                  <div key={tag} className="bg-black/20 border border-black/50 rounded px-2 py-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold">{tag}</div>
                      <div className="text-xs text-white/70">
                        Lv{level} ({count})
                      </div>
                    </div>
                    {next ? (
                      <div className="text-[10px] text-white/55 mt-0.5">
                        Next: {next} (need {Math.max(0, next - count)})
                      </div>
                    ) : (
                      <div className="text-[10px] text-white/55 mt-0.5">Max level</div>
                    )}
                  </div>
                ))}
              </div>
            </Frame>
          </div>

          {/* RIGHT = ROSTER */}
          <div
            className="bg-[#2b2f35] border border-black/80 rounded p-2 min-w-0"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const payload = readPayload(e.dataTransfer.getData("text/plain"));
              setDragging(null);
              if (!payload) return;

              const next = { ...party, support: [...support] };

              if (payload.type === "active") {
                if (payload.slot === 1) next.active1 = null;
                if (payload.slot === 2) next.active2 = null;
                applyParty(next);
                return;
              }

              if (payload.type === "support") {
                const idx = payload.index;
                if (typeof idx === "number") {
                  next.support[idx] = null;
                  applyParty(next);
                }
              }
            }}
          >
            <div className="flex items-center justify-between mb-2 gap-2">
              <div>
                <div className="text-sm font-extrabold">Roster</div>
                <div className="text-xs text-white/60">
                  Selected slot: <span className="font-semibold">{mode}</span> • Results:{" "}
                  <span className="font-semibold">{filteredRoster.length}</span>
                </div>
              </div>

              <input
                value={search}
                onChange={(e) => setState({ ...state, search: e.target.value })}
                placeholder='Search name/tag (es. "luffy", "zoan", "navy")'
                className="w-[520px] bg-black/40 border border-white/20 rounded px-2 py-1 text-sm"
              />
            </div>

            <div className="bg-black/20 border border-black/60 rounded p-2 mb-2">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="text-xs text-white/70 mr-1">Color:</div>
                {["All", "Red", "Blue", "Green", "Dark", "Light"].map((c) => (
                  <QuickButton
                    key={c}
                    active={rosterFilters.color === c}
                    onClick={() => setRosterFilters({ color: c })}
                  >
                    {c}
                  </QuickButton>
                ))}

                <div className="w-3" />

                <div className="text-xs text-white/70 mr-1">Role:</div>
                {["All", "Attacker", "Runner", "Defender"].map((r) => (
                  <QuickButton
                    key={r}
                    active={rosterFilters.role === r}
                    onClick={() => setRosterFilters({ role: r })}
                  >
                    {r}
                  </QuickButton>
                ))}

                <div className="w-3" />

                <QuickButton active={false} onClick={() => setRosterFilters({ color: "All", role: "All" })}>
                  Clear filters
                </QuickButton>
              </div>
            </div>

            <div className="h-[78vh] overflow-auto pr-1">
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))" }}>
                {filteredRoster.map((c) => {
                  const disabled = !canUseForSelectedSlot(c);
                  const selected =
                    active1?.id === c.id || active2?.id === c.id || support.some((s) => s?.id === c.id);

                  return (
                    <RosterTile
                      key={c.id}
                      char={c}
                      selected={selected}
                      disabled={disabled}
                      onClick={() => assignCharByClick(c)}
                      onDragStart={(p) => setDragging(p)}
                      onDragEnd={() => setDragging(null)}
                    />
                  );
                })}
              </div>
            </div>

            <div className="text-xs text-white/60 mt-2">
              Tip: trascina un Active/Support nel roster per liberare lo slot.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}