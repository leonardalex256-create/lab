import { SchoolSetting } from "../models/index.js";

export type OfficialTermYear = { term: string; academicYear: string };

export function normalizeOfficialTerm(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (t === "Term 2" || t === "Term 3") return t;
  return "Term 1";
}

export function normalizeOfficialYear(raw: string | null | undefined): string {
  const y = (raw ?? "").trim();
  if (/^\d{4}$/.test(y)) return y;
  return String(new Date().getFullYear());
}

/** Authoritative operational period from Settings → General (not viewing context). */
export async function loadOfficialSchoolTermYear(): Promise<OfficialTermYear> {
  const [termRow, yearRow] = await Promise.all([
    SchoolSetting.findByPk("current_term"),
    SchoolSetting.findByPk("academic_year"),
  ]);
  return {
    term: normalizeOfficialTerm(termRow?.settingValue ?? null),
    academicYear: normalizeOfficialYear(yearRow?.settingValue ?? null),
  };
}

/** For read APIs: optional query year; otherwise fall back to operational year from settings. */
export function parseQueryAcademicYear(raw: unknown, fallbackYear: string): string {
  const y = typeof raw === "string" ? raw.trim() : "";
  return /^\d{4}$/.test(y) ? y : normalizeOfficialYear(fallbackYear);
}

/**
 * Resolve term + year for list/read endpoints (viewing context from query).
 * Defaults to the school's operational term/year when params are omitted.
 */
export async function resolveReadTermYearFromQuery(query: {
  term?: unknown;
  academicYear?: unknown;
}): Promise<{ term: string; academicYear: string }> {
  const official = await loadOfficialSchoolTermYear();
  const termRaw = typeof query.term === "string" ? query.term.trim() : "";
  const term = termRaw || official.term;
  const academicYear = parseQueryAcademicYear(query.academicYear, official.academicYear);
  return { term, academicYear };
}
