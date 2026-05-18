/** Default subject list for prior/entry marks. */
export function subjectsForClassRoom(className: string): string[] {
  void className;
  return [];
}

export type AdmissionMarksPayload = {
  v: 1;
  marks: { subject: string; mark: string }[];
  /** Free-text previous grades / aggregates (required for new admission). */
  aggregates: string;
};

/** Parse a percentage out of 100 (optional trailing %, comma as decimal). */
export function parseOutOf100Mark(raw: string): number | null {
  const t = raw.trim().replace(/%$/u, "").replace(/,/g, ".").trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function isValidOutOf100Mark(n: number): boolean {
  return n >= 0 && n <= 100;
}

/** Round to 2 decimal places for storage (percent out of 100). */
export function formatOutOf100ForStorage(n: number): string {
  return String(Math.round(n * 100) / 100);
}

export function buildAdmissionMarksJson(
  subjects: string[],
  marks: Record<string, string>,
  aggregates: string,
): string {
  const payload: AdmissionMarksPayload = {
    v: 1,
    marks: subjects.map((subject) => ({
      subject,
      mark: (marks[subject] ?? "").trim(),
    })),
    aggregates: aggregates.trim(),
  };
  return JSON.stringify(payload);
}
