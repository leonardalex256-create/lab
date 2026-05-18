import { createContext, useContext, type ReactNode } from "react";

export type SchoolConfig = {
  schoolName: string;
  shortName: string;
  tagline: string;
  watermarkText: string;
  address: string;
  poBox: string;
  email: string;
  phone1: string;
  phone2?: string;
  badgeImagePath: string;
};

const DEFAULT_SCHOOL_CONFIG: SchoolConfig = {
  schoolName: "QUEENS NURSERY & PRIMARY SCHOOL",
  shortName: "OFFICIAL",
  tagline: "Build For The Future",
  watermarkText: "QUEENS",
  address: "Kitebi Star, After Trading Centre, Kampala",
  poBox: "9107",
  email: "queensprimaryschool13@gmail.com",
  phone1: "+256 782 333 908",
  phone2: "+256 750 775 572",
  badgeImagePath: "/school-badge-v2.png",
};

const SchoolConfigContext = createContext<SchoolConfig | null>(null);

export function SchoolConfigProvider({
  children,
  value,
}: {
  children: ReactNode;
  value?: Partial<SchoolConfig>;
}) {
  const merged: SchoolConfig = { ...DEFAULT_SCHOOL_CONFIG, ...(value ?? {}) };
  return <SchoolConfigContext.Provider value={merged}>{children}</SchoolConfigContext.Provider>;
}

export function useSchoolConfig(): SchoolConfig {
  return useContext(SchoolConfigContext) ?? DEFAULT_SCHOOL_CONFIG;
}

