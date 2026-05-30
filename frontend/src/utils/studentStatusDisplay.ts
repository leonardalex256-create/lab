import type { StudentStatusRow } from "../api/studentStatuses";

export type StudentStatusLike = {
  studentStatusId?: number | null;
  studentStatusCode?: string | null;
  studentStatusName?: string | null;
};

export function studentFeeStatusLabel(row: StudentStatusLike): string {
  if (row.studentStatusName && row.studentStatusCode) {
    return `${row.studentStatusName} (${row.studentStatusCode})`;
  }
  if (row.studentStatusName) return row.studentStatusName;
  if (row.studentStatusCode) return row.studentStatusCode;
  return "—";
}

export function statusLabelFromRow(
  row: StudentStatusRow | undefined,
  fallbackId?: number | null,
): string {
  if (row) return `${row.name} (${row.code})`;
  if (fallbackId) return `Status #${fallbackId}`;
  return "Not set";
}
