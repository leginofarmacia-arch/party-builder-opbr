import supportMatrix from "../data/supportMatrix.json";

export function getSupportPercent({
  baseStars,
  supportColor,
  boostTier,
  activeColor,
}) {
  if (!baseStars || !supportColor || !boostTier || !activeColor) {
    return { value: 0, status: "missing" };
  }

  const starsKey = String(baseStars);
  const boostKey = String(boostTier);

  const result =
    supportMatrix?.[starsKey]?.[supportColor]?.[boostKey]?.[activeColor];

  if (!result) {
    return { value: 0, status: "missing" };
  }

  return result;
}