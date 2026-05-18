const SMALL = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
  "fourteen",
  "fifteen",
  "sixteen",
  "seventeen",
  "eighteen",
  "nineteen",
];

const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

function chunkToWords(n: number): string {
  if (n < 20) return SMALL[n] ?? "";
  if (n < 100) {
    const tens = Math.floor(n / 10);
    const rem = n % 10;
    return rem ? `${TENS[tens]}-${SMALL[rem]}` : TENS[tens] ?? "";
  }
  const hundreds = Math.floor(n / 100);
  const rem = n % 100;
  if (rem === 0) return `${SMALL[hundreds]} hundred`;
  return `${SMALL[hundreds]} hundred and ${chunkToWords(rem)}`;
}

export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "zero";
  const safe = Math.floor(Math.min(n, 999_999_999));
  const million = Math.floor(safe / 1_000_000);
  const thousand = Math.floor((safe % 1_000_000) / 1_000);
  const rest = safe % 1_000;
  const parts: string[] = [];
  if (million > 0) parts.push(`${chunkToWords(million)} million`);
  if (thousand > 0) parts.push(`${chunkToWords(thousand)} thousand`);
  if (rest > 0) parts.push(chunkToWords(rest));
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

export function toSentenceCase(v: string): string {
  if (!v) return v;
  return v.charAt(0).toUpperCase() + v.slice(1);
}

