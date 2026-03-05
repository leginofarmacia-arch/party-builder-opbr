import { getCharacterIconPath } from "../utils/slugify";

export default function CharIcon({ char, size = 64 }) {
  if (!char) return null;

  return (
    <img
      src={getCharacterIconPath(char.name)}
      alt={char.name}
      style={{
        width: size,
        height: size,
        objectFit: "cover",
        borderRadius: 8,
      }}
      onError={(e) => {
        // se l'immagine non esiste → nasconde l'icona
        e.currentTarget.style.display = "none";
      }}
    />
  );
}