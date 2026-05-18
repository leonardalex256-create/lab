/**
 * Centralized helpers for converting calendar strings (YYYY-MM-DD, YYYY-MM)
 * into UTC datetime ranges suitable for Sequelize `Op.between` filters.
 *
 * Replaces the prior pattern of building string literals like
 *   `${today} 00:00:00`
 * which silently behaved differently across servers depending on the local
 * timezone of the database session.
 */

/** Returns `[startInclusive, endInclusive]` covering the calendar day in UTC. */
export function dayRangeUtc(ymd: string): [Date, Date] {
  const start = new Date(`${ymd}T00:00:00.000Z`);
  const end = new Date(`${ymd}T23:59:59.999Z`);
  return [start, end];
}

/** Returns `[startInclusive, endInclusive]` covering an entire month in UTC. */
export function monthRangeUtc(ym: string): [Date, Date] {
  const [y, m] = ym.split("-").map((p) => Number.parseInt(p, 10));
  const yy = Number.isFinite(y) ? (y as number) : new Date().getUTCFullYear();
  const mm = Number.isFinite(m) ? (m as number) : new Date().getUTCMonth() + 1;
  const start = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(yy, mm, 0, 23, 59, 59, 999));
  return [start, end];
}

/**
 * Returns `[start, end]` covering the calendar month containing the given
 * YYYY-MM-DD date in UTC.
 */
export function monthRangeForDateUtc(ymd: string): [Date, Date] {
  const ym = ymd.slice(0, 7);
  return monthRangeUtc(ym);
}
