import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchGeneralSettings } from "../api/settingsGeneral";
import { termContextStorageKey } from "./termContextStorage";

export const TERM_OPTIONS = ["Term 1", "Term 2", "Term 3"] as const;
export type TermLabel = (typeof TERM_OPTIONS)[number];

export function normalizeTerm(raw: string | undefined | null): TermLabel {
  const t = (raw ?? "").trim();
  if (t === "Term 2" || t === "Term 3") return t;
  return "Term 1";
}

export function normalizeAcademicYear(raw: string | undefined | null): string {
  const y = (raw ?? "").trim();
  if (/^\d{4}$/.test(y)) return y;
  return String(new Date().getFullYear());
}

type Persisted = { term: string; year: string };

type TermContextValue = {
  status: "loading" | "ready";
  viewingTerm: TermLabel;
  viewingAcademicYear: string;
  systemTerm: TermLabel;
  systemAcademicYear: string;
  isViewingSystemCurrent: boolean;
  /** When true, prefer disabling mutations for past term/year (non-admins). */
  historicalReadOnly: boolean;
  setViewingTerm: (t: TermLabel) => void;
  setViewingAcademicYear: (y: string) => void;
  resetViewingToSystem: () => void;
  yearChoices: string[];
};

const TermContext = createContext<TermContextValue | null>(null);

function readStored(sub: string | null | undefined): Persisted | null {
  try {
    const raw = sessionStorage.getItem(termContextStorageKey(sub));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Persisted>;
    if (typeof p.term !== "string" || typeof p.year !== "string") return null;
    return {
      term: normalizeTerm(p.term),
      year: normalizeAcademicYear(p.year),
    };
  } catch {
    return null;
  }
}

function writeStored(sub: string | null | undefined, p: Persisted) {
  try {
    sessionStorage.setItem(termContextStorageKey(sub), JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function buildYearChoices(centerYear: string): string[] {
  const y = Number(centerYear);
  const base = Number.isFinite(y) ? y : new Date().getFullYear();
  const out: string[] = [];
  for (let d = -5; d <= 5; d++) {
    out.push(String(base + d));
  }
  return out;
}

export function TermProvider({
  children,
  userSub,
  userRole,
}: {
  children: ReactNode;
  userSub: string | null | undefined;
  userRole: string | null | undefined;
}) {
  const [status, setStatus] = useState<"loading" | "ready">("loading");
  const [systemTerm, setSystemTerm] = useState<TermLabel>("Term 1");
  const [systemAcademicYear, setSystemAcademicYear] = useState<string>(() =>
    String(new Date().getFullYear()),
  );
  const [viewingTerm, setViewingTermState] = useState<TermLabel>("Term 1");
  const [viewingAcademicYear, setViewingAcademicYearState] = useState<string>(() =>
    String(new Date().getFullYear()),
  );

  const isAdmin = useMemo(() => {
    const r = String(userRole ?? "").toLowerCase();
    return r === "admin" || r === "super_admin";
  }, [userRole]);

  useEffect(() => {
    let cancelled = false;
    const stored = readStored(userSub ?? null);
    if (stored && TERM_OPTIONS.includes(stored.term as TermLabel)) {
      setViewingTermState(stored.term as TermLabel);
      setViewingAcademicYearState(stored.year);
    }

    void fetchGeneralSettings()
      .then((s) => {
        if (cancelled) return;
        const st = normalizeTerm(s.current_term);
        const sy = normalizeAcademicYear(s.academic_year);
        setSystemTerm(st);
        setSystemAcademicYear(sy);

        if (!stored || !TERM_OPTIONS.includes(stored.term as TermLabel)) {
          setViewingTermState(st);
          setViewingAcademicYearState(sy);
        }
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("ready");
      });

    return () => {
      cancelled = true;
    };
  }, [userSub]);

  const yearChoices = useMemo(() => {
    const c = buildYearChoices(systemAcademicYear);
    const set = new Set(c);
    if (!set.has(viewingAcademicYear)) set.add(viewingAcademicYear);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [systemAcademicYear, viewingAcademicYear]);

  const isViewingSystemCurrent =
    viewingTerm === systemTerm && viewingAcademicYear === systemAcademicYear;

  const historicalReadOnly = !isViewingSystemCurrent && !isAdmin;

  const setViewingTerm = useCallback(
    (t: TermLabel) => {
      setViewingTermState(t);
      writeStored(userSub ?? null, { term: t, year: viewingAcademicYear });
    },
    [userSub, viewingAcademicYear],
  );

  const setViewingAcademicYear = useCallback(
    (y: string) => {
      const ny = normalizeAcademicYear(y);
      setViewingAcademicYearState(ny);
      writeStored(userSub ?? null, { term: viewingTerm, year: ny });
    },
    [userSub, viewingTerm],
  );

  const resetViewingToSystem = useCallback(() => {
    setViewingTermState(systemTerm);
    setViewingAcademicYearState(systemAcademicYear);
    writeStored(userSub ?? null, { term: systemTerm, year: systemAcademicYear });
  }, [userSub, systemTerm, systemAcademicYear]);

  const value = useMemo<TermContextValue>(
    () => ({
      status,
      viewingTerm,
      viewingAcademicYear,
      systemTerm,
      systemAcademicYear,
      isViewingSystemCurrent,
      historicalReadOnly,
      setViewingTerm,
      setViewingAcademicYear,
      resetViewingToSystem,
      yearChoices,
    }),
    [
      status,
      viewingTerm,
      viewingAcademicYear,
      systemTerm,
      systemAcademicYear,
      isViewingSystemCurrent,
      historicalReadOnly,
      setViewingTerm,
      setViewingAcademicYear,
      resetViewingToSystem,
      yearChoices,
    ],
  );

  return <TermContext.Provider value={value}>{children}</TermContext.Provider>;
}

export function useTermContext(): TermContextValue {
  const ctx = useContext(TermContext);
  if (!ctx) {
    throw new Error("useTermContext must be used within TermProvider");
  }
  return ctx;
}
