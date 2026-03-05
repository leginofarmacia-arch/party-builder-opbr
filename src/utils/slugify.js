// Converte il nome del personaggio in nome file icona
export const slugifyName = (name = "") =>
  name
    .toLowerCase()
    .replace(/\n/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// Restituisce il percorso dell'icona
export const getCharacterIconPath = (name) => {
  const slug = slugifyName(name);
  return `/icons/chars/${slug}.png`;
};