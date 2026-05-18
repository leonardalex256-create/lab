export const TERM_CTX_STORAGE_PREFIX = "term_ctx_";

export function termContextStorageKey(sub: string | null | undefined): string {
  const s = typeof sub === "string" ? sub.trim() : "";
  return `${TERM_CTX_STORAGE_PREFIX}${s || "anon"}`;
}

export function clearTermContextStorage(sub: string | null | undefined): void {
  try {
    sessionStorage.removeItem(termContextStorageKey(sub));
  } catch {
    /* privacy mode / quota */
  }
}
