/** Client-side hints for plain-English fee rules (authoritative parse is on the API). */
export const PLAIN_ENGLISH_EXAMPLES = [
  "Apply 10% discount on tuition",
  "5% sibling discount when sibling count > 0",
  "Reduce by bursary percentage",
  "Double the base amount",
] as const;

export function summarizePlainEnglishLocally(text: string): string {
  const lower = text.trim().toLowerCase();
  if (!lower) return "Enter a rule description to interpret.";
  if (lower.includes("10%") && lower.includes("discount")) {
    return "Likely: 10% off base amount (confirm via Interpret).";
  }
  if (lower.includes("sibling")) return "Likely: sibling-based discount (confirm via Interpret).";
  if (lower.includes("bursary")) return "Likely: reduce by bursary % (confirm via Interpret).";
  return "Use “Interpret rule” to convert to a formula.";
}
