import XLSX from "xlsx";
import fs from "fs";

const filePath = "OPBR Characters Database v.26.01.27.xlsx";

const workbook = XLSX.readFile(filePath);

// Usa foglio che contiene "Characters" se presente
const sheetName =
  workbook.SheetNames.find((n) => n.toLowerCase().includes("character")) ??
  workbook.SheetNames[0];

const sheet = workbook.Sheets[sheetName];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

function parseTags(cell) {
  if (!cell) return [];
  return String(cell)
    .replace(/\r/g, "")
    .split(/\n|\/|,|;|\|/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

// Estrae colori se presenti nel testo (es. "Red/Green/Blue Attacker")
function extractColors(text) {
  const s = String(text || "").toLowerCase();
  const found = [];
  const push = (c) => {
    if (!found.includes(c)) found.push(c);
  };

  // parole intere
  if (s.includes("red")) push("Red");
  if (s.includes("blue")) push("Blue");
  if (s.includes("green")) push("Green");
  if (s.includes("light")) push("Light");
  if (s.includes("dark")) push("Dark");

  // abbreviazioni comuni tipo "R Attacker" (se mai presenti)
  // attenzione: le usiamo solo se non abbiamo trovato colori parola intera
  if (found.length === 0) {
    const tokens = s.replace(/[()]/g, "").split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      if (t === "r") push("Red");
      if (t === "b") push("Blue");
      if (t === "g") push("Green");
      if (t === "l") push("Light");
      if (t === "d") push("Dark");
    }
  }

  return found;
}

function parseColorRoleFromB(b) {
  const s = String(b || "").trim();
  const low = s.toLowerCase();

  const colors = extractColors(low);
  const primaryColor = colors[0] || "";

  let role = "";
  if (low.includes("attacker")) role = "Attacker";
  else if (low.includes("defender")) role = "Defender";
  else if (low.includes("runner")) role = "Runner";

  return { primaryColor, colors, role };
}

/**
 * Override multi-colore:
 * - chiave: nome (case-insensitive, match "includes")
 * - value: array colori completo (il primo resta dominante ai fini del support%)
 *
 * Nota: qui mettiamo esattamente i casi che mi hai indicato.
 * Se in futuro ne trovi altri, li aggiungiamo in 10 secondi.
 */
const MULTICOLOR_OVERRIDES = [
  { match: "egghead brook", colors: ["Red", "Green", "Blue"] },
  { match: "ama no murakumo sword kizaru", colors: ["Blue", "Red", "Green"] },
  { match: "zoro onigashima", colors: ["Green", "Red", "Blue"] },
  { match: "sanji onigashima", colors: ["Blue", "Red", "Green"] },
  { match: "disciple of the martial arts", colors: ["Green", "Red", "Blue"] },
  { match: "kung fu jugon", colors: ["Green", "Red", "Blue"] },
];

function applyMultiColorOverride(name, primaryColorFromB, colorsFromB) {
  const n = String(name || "").toLowerCase();

  const rule = MULTICOLOR_OVERRIDES.find((x) => n.includes(x.match));
  if (!rule) {
    // nessun override: se B aveva 1 colore, manteniamo quello
    return {
      primaryColor: primaryColorFromB,
      colors: colorsFromB?.length ? colorsFromB : (primaryColorFromB ? [primaryColorFromB] : []),
    };
  }

  // Se B fornisce un primaryColor, forziamo che sia il primo (dominante) per la %.
  // Se non coincide con l’override, mettiamo comunque quello di B come primo (dominante),
  // e gli altri a seguire senza duplicati.
  const final = [];
  const push = (c) => {
    if (c && !final.includes(c)) final.push(c);
  };

  push(primaryColorFromB);
  for (const c of rule.colors) push(c);

  return {
    primaryColor: final[0] || primaryColorFromB || "",
    colors: final,
  };
}

const characters = [];

for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  if (!r) continue;

  // Colonne: A=0, B=1, C=2, D=3, E=4, F=5, G=6
  const colB = r[1]; // es: "Dark Defender"
  const colD = (r[3] ?? "").toString().trim();
  const colE = (r[4] ?? "").toString().trim();
  const colG = (r[6] ?? "").toString().trim(); // tags support

  const bLow = String(colB || "").toLowerCase();
  const looksLikeColorRole =
    bLow.includes("attacker") || bLow.includes("defender") || bLow.includes("runner");

  if (!colG || !looksLikeColorRole) continue;

  // Nome: preferibilmente in E, altrimenti D
  const name = colE || colD;
  if (!name) continue;

  const tags = parseTags(colG);
  const parsed = parseColorRoleFromB(colB);

  // Applica override multi-colore (se match)
  const mc = applyMultiColorOverride(name, parsed.primaryColor, parsed.colors);

  characters.push({
    id: characters.length + 1,
    name,
    primaryColor: mc.primaryColor,
    colors: mc.colors,
    color: mc.primaryColor, // compatibilità con UI attuale
    role: parsed.role,
    power: 0,
    tags,
  });
}

fs.writeFileSync(
  "./src/data/characters.json",
  JSON.stringify(characters, null, 2),
  "utf-8"
);

console.log("Foglio usato:", sheetName);
console.log("Conversione completata:", characters.length, "personaggi");

// Debug utile: stampa i multi-color trovati (se presenti)
const debug = characters.filter((c) => (c.colors || []).length > 1).slice(0, 15);
console.log("Esempi multi-colore (max 15):");
for (const c of debug) console.log("-", c.name, "=>", c.colors, "(primary:", c.primaryColor + ")");
