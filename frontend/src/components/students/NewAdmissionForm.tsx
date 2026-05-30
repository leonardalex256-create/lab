import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchCountries,
  fetchDistricts,
  fetchNationalities,
  type CountryOption,
} from "../../api/geo";
import {
  fetchClassSections,
  createStudent,
  fetchClassrooms,
  uploadStudentPhoto,
  type ClassRoomOption,
  type ClassSectionOption,
} from "../../api/students";
import { fetchGeneralSettings } from "../../api/settingsGeneral";
import { fetchFeeStructure, type FeeStructureRow } from "../../api/financeFeeStructure";
import { assignStudentFee } from "../../api/financeStatements";
import { formatCurrencyUGX } from "../finance/shared/financeFormat";
import { useI18n } from "../../i18n/I18nProvider";
import { useTermContext } from "../../context/TermContext";

type NewAdmissionFormProps = {
  onCreated: () => void;
};

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 hover:border-slate-300";

const religions = [
  "Christian",
  "Muslim",
  "Catholic",
  "Protestant",
  "Born Again",
  "Seventh-day Adventist",
  "Orthodox",
  "Traditional",
  "Other",
];

export function NewAdmissionForm({ onCreated }: NewAdmissionFormProps) {
  const { t } = useI18n();
  const { systemTerm, status: termCtxStatus } = useTermContext();
  const [rooms, setRooms] = useState<ClassRoomOption[]>([]);
  const [loadRoomsError, setLoadRoomsError] = useState<string | null>(null);
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [sections, setSections] = useState<ClassSectionOption[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsStreamsEnabled, setSectionsStreamsEnabled] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [gender, setGender] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [classRoomId, setClassRoomId] = useState("");
  const [nationality, setNationality] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [district, setDistrict] = useState("");
  const [registrationType, setRegistrationType] = useState<"first" | "continuing" | "">("");
  const [transferReason, setTransferReason] = useState<
    "" | "relocation" | "discipline" | "better_education"
  >("");
  const [parentAliveStatus, setParentAliveStatus] = useState<"both" | "one" | "none" | "">("");
  const [singleParentType, setSingleParentType] = useState<"mother" | "father" | "">("");
  const [parentFullName, setParentFullName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentAddress, setParentAddress] = useState("");
  const [religion, setReligion] = useState("");
  const [specialNeeds, setSpecialNeeds] = useState("");
  const [boardingStatus, setBoardingStatus] = useState<
    "boarding" | "day_half" | "day_full" | ""
  >("");
  const [residenceAddress, setResidenceAddress] = useState("");
  const [medicalInfo, setMedicalInfo] = useState("");
  const [moreInformation, setMoreInformation] = useState("");
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [selectedTerm, setSelectedTerm] = useState("Term 1");
  const [feeRows, setFeeRows] = useState<FeeStructureRow[]>([]);
  const [selectedFeeStatus, setSelectedFeeStatus] = useState("");
  const [feeAssignmentNotes, setFeeAssignmentNotes] = useState("");
  const [feeLoading, setFeeLoading] = useState(false);
  const [feeLoadError, setFeeLoadError] = useState<string | null>(null);
  const [assignFeeEnabled, setAssignFeeEnabled] = useState(true);
  const [feeSuggestionNote, setFeeSuggestionNote] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const lastAutoNationalityRef = useRef<string | null>(null);
  const activeRooms = useMemo(
    () => rooms.filter((r) => r.isActive !== false),
    [rooms],
  );
  const sortedActiveRooms = useMemo(
    () =>
      [...activeRooms].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [activeRooms],
  );
  const selectedClassRoom = useMemo(() => {
    const id = Number.parseInt(classRoomId, 10);
    if (!Number.isFinite(id) || id <= 0) return null;
    return rooms.find((room) => room.id === id) ?? null;
  }, [classRoomId, rooms]);
  const selectedFeeRow = useMemo(
    () => feeRows.find((row) => row.status === selectedFeeStatus) ?? null,
    [feeRows, selectedFeeStatus],
  );

  useEffect(() => {
    let cancelled = false;
    void fetchClassrooms()
      .then((list) => {
        if (!cancelled) setRooms(list);
      })
      .catch(() => {
        if (!cancelled) setLoadRoomsError(t("students.form.classroomsError"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  useEffect(() => {
    if (termCtxStatus !== "ready") return;
    setSelectedTerm(systemTerm);
  }, [termCtxStatus, systemTerm]);

  useEffect(() => {
    let cancelled = false;
    void fetchGeneralSettings()
      .then((settings) => {
        if (cancelled) return;
        setSectionsStreamsEnabled((settings.classes_sections_streams_enabled ?? "yes") === "yes");
      })
      .catch(() => {
        if (!cancelled) setSectionsStreamsEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchNationalities(), fetchCountries()])
      .then(([nat, ctry]) => {
        if (!cancelled) {
          setGeoError(null);
          setNationalities(nat);
          setCountries(ctry);
        }
      })
      .catch(() => {
        if (!cancelled) setGeoError(t("students.form.geoLoadError"));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once
  }, []);

  const sortedNationalities = useMemo(() => {
    return [...nationalities].sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    );
  }, [nationalities]);

  const sortedCountries = useMemo(() => {
    return [...countries].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [countries]);

  const countryCodeToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of countries) {
      map.set(c.code.trim().toUpperCase(), c.name);
    }
    return map;
  }, [countries]);

  const nationalityLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nationalities) {
      const key = n.trim().toLowerCase();
      if (!key) continue;
      if (!map.has(key)) map.set(key, n);
    }
    return map;
  }, [nationalities]);

  useEffect(() => {
    const code = countryCode.trim().toUpperCase();
    if (!code) return;
    const countryName = countryCodeToName.get(code);
    if (!countryName) return;

    // Minimal curated country -> nationality mapping (demonym).
    // We only auto-fill when the resulting nationality exists in the loaded list.
    const demonymByCountry: Record<string, string> = {
      uganda: "Ugandan",
      kenya: "Kenyan",
      tanzania: "Tanzanian",
      rwanda: "Rwandan",
      burundi: "Burundian",
      "south sudan": "South Sudanese",
      sudan: "Sudanese",
      ethiopia: "Ethiopian",
      somalia: "Somali",
      eritrea: "Eritrean",
      nigeria: "Nigerian",
      ghana: "Ghanaian",
      "south africa": "South African",
      zambia: "Zambian",
      zimbabwe: "Zimbabwean",
      malawi: "Malawian",
      "united kingdom": "British",
      uk: "British",
      "united states": "American",
      "united states of america": "American",
      usa: "American",
      india: "Indian",
      china: "Chinese",
      france: "French",
      germany: "German",
      egypt: "Egyptian",
      algeria: "Algerian",
      angola: "Angolan",
      afghanistan: "Afghan",
      bangladesh: "Bangladeshi",
      cameroon: "Cameroonian",
      "congo (drc)": "Congolese (DRC)",
      "democratic republic of the congo": "Congolese (DRC)",
    };

    const normalizedCountry = countryName.trim().toLowerCase();
    const proposed = demonymByCountry[normalizedCountry];
    if (!proposed) return;
    const exact = nationalityLookup.get(proposed.trim().toLowerCase());
    if (!exact) return;

    // Only auto-fill if user hasn't intentionally chosen a different value.
    // If current nationality is empty/unset OR was previously auto-filled, we can replace it.
    const current = nationality.trim();
    const lastAuto = (lastAutoNationalityRef.current ?? "").trim();
    const canAutoReplace =
      !current || current === t("students.form.nationalityUnset") || current === lastAuto;
    if (!canAutoReplace) return;

    lastAutoNationalityRef.current = exact;
    setNationality(exact);
  }, [countryCode, countryCodeToName, nationalityLookup, nationality, t]);

  useEffect(() => {
    const code = countryCode.trim();
    if (!code) {
      setDistricts([]);
      setDistrict("");
      return;
    }
    let cancelled = false;
    setDistrictsLoading(true);
    void fetchDistricts(code)
      .then((list) => {
        if (!cancelled) {
          setGeoError(null);
          setDistricts(list);
          setDistrict((d) => (d && list.includes(d) ? d : ""));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDistricts([]);
          setDistrict("");
          setGeoError(t("students.form.geoLoadError"));
        }
      })
      .finally(() => {
        if (!cancelled) setDistrictsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, t]);

  useEffect(() => {
    if (!sectionsStreamsEnabled) {
      setSectionName("");
      return;
    }
    const id = Number.parseInt(classRoomId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      setSectionName("");
      return;
    }
    if (sectionsLoading) {
      setSectionName("");
      return;
    }
    if (sections.length > 0) {
      setSectionName(sections[0].name);
    } else {
      setSectionName("");
    }
  }, [classRoomId, sections, sectionsLoading, sectionsStreamsEnabled]);

  useEffect(() => {
    if (!sectionsStreamsEnabled) {
      setSections([]);
      setSectionsLoading(false);
      return;
    }
    const id = Number.parseInt(classRoomId, 10);
    if (!Number.isFinite(id) || id <= 0) {
      setSections([]);
      return;
    }
    let cancelled = false;
    setSections([]);
    setSectionsLoading(true);
    void fetchClassSections(id)
      .then((list) => {
        if (!cancelled) setSections(list);
      })
      .catch(() => {
        if (!cancelled) setSections([]);
      })
      .finally(() => {
        if (!cancelled) setSectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classRoomId, sectionsStreamsEnabled]);

  useEffect(() => {
    let cancelled = false;
    setFeeLoading(true);
    void fetchFeeStructure(selectedTerm)
      .then((rows) => {
        if (cancelled) return;
        setFeeRows(rows);
        setFeeLoadError(null);
        setSelectedFeeStatus((prev) => {
          if (prev && rows.some((row) => row.status === prev)) return prev;
          return rows[0]?.status ?? "";
        });
      })
      .catch((err) => {
        if (!cancelled) {
          setFeeRows([]);
          setSelectedFeeStatus("");
          setFeeLoadError(err instanceof Error ? err.message : "Failed to load fee structures.");
        }
      })
      .finally(() => {
        if (!cancelled) setFeeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTerm]);

  useEffect(() => {
    if (feeRows.length === 0) {
      setFeeSuggestionNote(null);
      return;
    }
    const normalized = boardingStatus.toLowerCase();
    const candidates: string[] = [];
    if (normalized === "boarding") candidates.push("boarding");
    if (normalized === "day_full") candidates.push("day_full");
    if (normalized === "day_half") candidates.push("day_half");

    const matchedByStatus = candidates
      .map((key) => feeRows.find((row) => row.status === key))
      .find((row): row is FeeStructureRow => Boolean(row));

    if (matchedByStatus) {
      setSelectedFeeStatus(matchedByStatus.status);
      setFeeSuggestionNote(`Suggested from boarding status "${boardingStatus}".`);
      return;
    }

    const labelHint =
      normalized === "boarding"
        ? "boarding"
        : normalized === "day_half"
          ? "half"
          : normalized === "day_full"
            ? "full"
            : "";
    const matchedByLabel = labelHint
      ? feeRows.find((row) => row.label.toLowerCase().includes(labelHint))
      : null;
    if (matchedByLabel) {
      setSelectedFeeStatus(matchedByLabel.status);
      setFeeSuggestionNote(`Suggested from boarding status "${boardingStatus}".`);
      return;
    }

    setFeeSuggestionNote("No exact match found. You can choose a fee structure manually.");
  }, [boardingStatus, feeRows]);

  const resetForm = () => {
    setFirstName("");
    setMiddleName("");
    setLastName("");
    setDateOfBirth("");
    setParentEmail("");
    setGender("");
    setSectionName("");
    setClassRoomId("");
    setSections([]);
    setNationality("");
    lastAutoNationalityRef.current = null;
    setCountryCode("");
    setDistrict("");
    setDistricts([]);
    setRegistrationType("");
    setTransferReason("");
    setParentAliveStatus("");
    setSingleParentType("");
    setParentFullName("");
    setParentPhone("");
    setParentAddress("");
    setReligion("");
    setSpecialNeeds("");
    setBoardingStatus("");
    setResidenceAddress("");
    setMedicalInfo("");
    setMoreInformation("");
    setEmergencyContactName("");
    setEmergencyContactPhone("");
    setGuardianName("");
    setGuardianPhone("");
    setPhotoFile(null);
    setFeeAssignmentNotes("");
    setAssignFeeEnabled(true);
    setFeeSuggestionNote(null);
    setSelectedFeeStatus((prev) => {
      if (prev && feeRows.some((row) => row.status === prev)) return prev;
      return feeRows[0]?.status ?? "";
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);
    setSubmitting(true);
    try {
      if (!firstName.trim() || !lastName.trim()) {
        setFormError(t("students.form.firstLastRequired"));
        setSubmitting(false);
        return;
      }
      const cr =
        classRoomId.trim() === "" ? undefined : Number.parseInt(classRoomId, 10);
      if (!cr || !Number.isFinite(cr) || cr <= 0) {
        setFormError(t("students.form.classRequired"));
        setSubmitting(false);
        return;
      }
      if (!boardingStatus) {
        setFormError(t("students.form.boardingStatusUnset"));
        setSubmitting(false);
        return;
      }
      if (!registrationType) {
        setFormError(t("students.form.registrationTypeUnset"));
        setSubmitting(false);
        return;
      }
      const cc = countryCode.trim();
      const dist = district.trim();
      const created = await createStudent({
        firstName: firstName.trim(),
        middleName: middleName.trim() || undefined,
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth.trim() || undefined,
        parentEmail: parentEmail.trim() || undefined,
        classRoomId: cr,
        gender: gender.trim() || undefined,
        sectionName: sectionName.trim() || undefined,
        nationality: nationality.trim() || undefined,
        countryCode: cc ? cc : undefined,
        district: dist || undefined,
        registrationType,
        previousGrades: undefined,
        transferReason: registrationType === "continuing" && transferReason ? transferReason : undefined,
        parentAliveStatus: parentAliveStatus || undefined,
        parentFullName: parentFullName.trim() || undefined,
        parentPhone: parentPhone.trim() || undefined,
        parentAddress: parentAddress.trim() || undefined,
        religion: religion || undefined,
        specialNeeds: specialNeeds.trim() || undefined,
        boardingStatus: boardingStatus || undefined,
        residenceAddress: residenceAddress.trim() || undefined,
        medicalInfo: medicalInfo.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim() || undefined,
      });

      let feeAssignmentMessage = "";
      if (assignFeeEnabled && selectedFeeRow && selectedFeeRow.amountDueUgx > 0) {
        try {
          const notesPayload = [
            `Fee type: ${selectedFeeRow.label}`,
            selectedFeeRow.notes ? `Structure note: ${selectedFeeRow.notes}` : "",
            feeAssignmentNotes.trim(),
          ]
            .filter(Boolean)
            .join(" | ");
          await assignStudentFee({
            studentId: created.id,
            term: selectedTerm,
            amountDueUgx: Math.max(Number(selectedFeeRow.amountDueUgx) || 0, 0),
            notes: notesPayload || undefined,
          });
          feeAssignmentMessage = ` Fee assigned: ${selectedFeeRow.label} (${formatCurrencyUGX(selectedFeeRow.amountDueUgx)}) for ${selectedTerm}.`;
        } catch (feeErr) {
          feeAssignmentMessage = ` Student created, but fee assignment failed: ${feeErr instanceof Error ? feeErr.message : "Unknown error."}`;
        }
      }

      if (photoFile) {
        try {
          await uploadStudentPhoto(created.id, photoFile);
        } catch {
          setFormSuccess(
            `${t("students.form.success")} ${t("students.photo.uploadLaterHint")}${feeAssignmentMessage}`,
          );
          resetForm();
          onCreated();
          return;
        }
      }
      setFormSuccess(
        `${t("students.form.success")} (${t("students.form.admissionNumberLabel")}: ${created.admissionNumber}).${feeAssignmentMessage}`,
      );
      resetForm();
      onCreated();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : t("students.form.error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      {/* Header Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 px-8 py-10 shadow-xl sm:px-12 sm:py-12">
        <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full bg-white/5 blur-3xl"></div>
        <div className="absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">{t("students.form.title")}</h2>
          <p className="mt-3 max-w-2xl text-base text-indigo-200">
            Register a new student into the system. Fill out their personal information, academic details, and parent/guardian contacts below to ensure a complete profile.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Alerts */}
        {geoError || loadRoomsError || formError ? (
          <div className="flex animate-in fade-in slide-in-from-bottom-2 items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-800 shadow-sm">
            <svg className="h-5 w-5 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{geoError} {loadRoomsError} {formError}</p>
          </div>
        ) : null}
        {formSuccess ? (
          <div className="flex animate-in fade-in slide-in-from-bottom-2 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-medium text-emerald-800 shadow-sm">
            <svg className="h-5 w-5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{formSuccess}</p>
          </div>
        ) : null}

        {/* Section 1: Personal Information */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">1</span>
              Personal Information
            </h3>
          </div>
          <div className="grid gap-x-6 gap-y-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.firstName")} <span className="text-rose-500">*</span></span>
              <input required value={firstName} onChange={(e) => setFirstName(e.target.value)} className={fieldClass} autoComplete="given-name" placeholder="E.g. John" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.middleName")}</span>
              <input value={middleName} onChange={(e) => setMiddleName(e.target.value)} className={fieldClass} autoComplete="additional-name" placeholder="Optional" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.lastName")} <span className="text-rose-500">*</span></span>
              <input required value={lastName} onChange={(e) => setLastName(e.target.value)} className={fieldClass} autoComplete="family-name" placeholder="E.g. Doe" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.dob")} <span className="text-rose-500">*</span></span>
              <input type="date" required value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={fieldClass} />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.gender")} <span className="text-rose-500">*</span></span>
              <select required value={gender} onChange={(e) => setGender(e.target.value)} className={fieldClass}>
                <option value="">{t("students.form.genderUnset")}</option>
                <option value="Female">{t("students.form.genderFemale")}</option>
                <option value="Male">{t("students.form.genderMale")}</option>
                <option value="Other">{t("students.form.genderOther")}</option>
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.religion")} <span className="text-rose-500">*</span></span>
              <select required value={religion} onChange={(e) => setReligion(e.target.value)} className={fieldClass}>
                <option value="">{t("students.form.religionUnset")}</option>
                {religions.map((r) => (<option key={r} value={r}>{r}</option>))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.nationality")} <span className="text-rose-500">*</span></span>
              <select
                required
                value={nationality}
                onChange={(e) => {
                  lastAutoNationalityRef.current = null;
                  setNationality(e.target.value);
                }}
                className={fieldClass}
              >
                <option value="">{t("students.form.nationalityUnset")}</option>
                {sortedNationalities.map((n) => (<option key={n} value={n}>{n}</option>))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.country")} <span className="text-rose-500">*</span></span>
              <select required value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setDistrict(""); }} className={fieldClass}>
                <option value="">{t("students.form.countryUnset")}</option>
                {sortedCountries.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.district")}</span>
              <select value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!countryCode.trim() || districtsLoading} className={`${fieldClass} disabled:opacity-60 disabled:bg-slate-50`}>
                <option value="">
                  {!countryCode.trim() ? t("students.form.districtPickCountry") : districtsLoading ? t("students.form.districtLoading") : t("students.form.districtUnset")}
                </option>
                {districts.map((d) => (<option key={d} value={d}>{d}</option>))}
              </select>
            </label>
          </div>
        </div>

        {/* Section 6: Fees Assignment */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">6</span>
              Student Fees Assignment
            </h3>
          </div>
          <div className="grid gap-x-6 gap-y-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
            <label className="col-span-full flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <input
                type="checkbox"
                checked={assignFeeEnabled}
                onChange={(e) => setAssignFeeEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-slate-700">
                Assign fee structure to this student during admission
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Term</span>
              <select
                value={selectedTerm}
                onChange={(e) => setSelectedTerm(e.target.value)}
                className={fieldClass}
                disabled={!assignFeeEnabled}
              >
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Fee Structure</span>
              <select
                value={selectedFeeStatus}
                onChange={(e) => setSelectedFeeStatus(e.target.value)}
                className={fieldClass}
                disabled={!assignFeeEnabled || feeLoading || feeRows.length === 0}
              >
                <option value="">
                  {feeLoading ? "Loading fee structures..." : feeRows.length === 0 ? "No fee structures available" : "Select fee structure"}
                </option>
                {feeRows.map((row) => (
                  <option key={row.status} value={row.status}>
                    {row.label} - {formatCurrencyUGX(row.amountDueUgx)}
                  </option>
                ))}
              </select>
            </label>
            {feeSuggestionNote ? (
              <div className="col-span-full rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-xs font-medium text-indigo-700">
                {feeSuggestionNote}
              </div>
            ) : null}
            {feeLoadError ? (
              <div className="col-span-full rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
                {feeLoadError}
              </div>
            ) : null}
            <label className="block col-span-full">
              <span className="mb-1.5 block text-xs font-semibold text-slate-600">Fee Assignment Notes (Optional)</span>
              <textarea
                value={feeAssignmentNotes}
                onChange={(e) => setFeeAssignmentNotes(e.target.value)}
                disabled={!assignFeeEnabled}
                className={`${fieldClass} min-h-[84px] resize-none`}
                placeholder="Optional note for this student's fee assignment."
              />
            </label>
            {selectedFeeRow ? (
              <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-slate-700">
                  Selected amount: <span className="font-bold text-slate-900">{formatCurrencyUGX(selectedFeeRow.amountDueUgx)}</span>
                </p>
                {selectedFeeRow.notes ? (
                  <p className="mt-1 text-xs text-slate-500">Structure note: {selectedFeeRow.notes}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* Section 2: Academic Details */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">2</span>
              Academic Details
            </h3>
          </div>
          <div className="grid gap-x-6 gap-y-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.registrationType")} <span className="text-rose-500">*</span></span>
              <select required value={registrationType} onChange={(e) => {
                const v = e.target.value as "first" | "continuing" | "";
                setRegistrationType(v);
                if (v !== "continuing") setTransferReason("");
              }} className={fieldClass}>
                <option value="">{t("students.form.registrationTypeUnset")}</option>
                <option value="first">{t("students.form.registrationNewAdmission")}</option>
                <option value="continuing">{t("students.form.registrationTransferIn")}</option>
              </select>
            </label>
            {registrationType === "continuing" ? (
              <label className="block animate-in fade-in zoom-in-95">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.transferReason")}</span>
                <select value={transferReason} onChange={(e) => setTransferReason(e.target.value as any)} className={fieldClass}>
                  <option value="">{t("students.form.transferReasonUnset")}</option>
                  <option value="relocation">{t("students.form.transferReasonRelocation")}</option>
                  <option value="discipline">{t("students.form.transferReasonDiscipline")}</option>
                  <option value="better_education">{t("students.form.transferReasonBetterEducation")}</option>
                </select>
              </label>
            ) : <div className="hidden sm:block"></div>}
            <div className="hidden lg:block"></div>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.classroom")} <span className="text-rose-500">*</span></span>
              <select required value={classRoomId} onChange={(e) => setClassRoomId(e.target.value)} className={fieldClass}>
                <option value="">{t("students.form.classroomUnset")}</option>
                {sortedActiveRooms.map((r) => (
                  <option key={r.id} value={String(r.id)}>{r.name} {r.academicYear ? `(${r.academicYear})` : ""}</option>
                ))}
              </select>
            </label>
            
            <div className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">Class Category</span>
              <div className={`${fieldClass} flex min-h-[44px] items-center text-slate-700 bg-slate-50`}>
                {!classRoomId ? "Select class first" : selectedClassRoom?.categoryName || "No category assigned"}
              </div>
            </div>

            {sectionsStreamsEnabled ? (
              <div className="block">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.section")}</span>
                <div className={`${fieldClass} flex min-h-[44px] items-center text-slate-700 bg-slate-50`}>
                  {!classRoomId ? t("students.form.sectionPickClass") : sectionsLoading ? t("students.form.sectionLoading") : sectionName || t("students.form.sectionNoData")}
                </div>
              </div>
            ) : <div className="hidden lg:block"></div>}

            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.boardingStatus")} <span className="text-rose-500">*</span></span>
              <select required value={boardingStatus} onChange={(e) => setBoardingStatus(e.target.value as any)} className={fieldClass}>
                <option value="">{t("students.form.boardingStatusUnset")}</option>
                <option value="day_half">{t("students.form.boardingStatusDayHalf")}</option>
                <option value="day_full">{t("students.form.boardingStatusDayFull")}</option>
                <option value="boarding">{t("students.form.boardingStatusBoarding")}</option>
              </select>
            </label>
          </div>
        </div>

        {/* Section 3: Parent/Guardian Information */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">3</span>
              Parent / Guardian Details
            </h3>
          </div>
          <div className="grid gap-x-6 gap-y-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block col-span-full sm:col-span-1">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.parentAliveStatus")} <span className="text-rose-500">*</span></span>
              <select required value={parentAliveStatus} onChange={(e) => {
                const next = e.target.value as "both" | "one" | "none" | "";
                setParentAliveStatus(next);
                if (next !== "one") setSingleParentType("");
                if (next === "none") {
                  setParentFullName(""); setParentPhone(""); setParentEmail(""); setParentAddress("");
                } else {
                  setGuardianName(""); setGuardianPhone("");
                }
              }} className={fieldClass}>
                <option value="">{t("students.form.parentAliveUnset")}</option>
                <option value="both">{t("students.form.parentAliveBoth")}</option>
                <option value="one">{t("students.form.parentAliveOne")}</option>
                <option value="none">{t("students.form.parentAliveNone")}</option>
              </select>
            </label>

            {parentAliveStatus === "one" ? (
              <label className="block animate-in fade-in col-span-full sm:col-span-1">
                <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.singleParentType")}</span>
                <select value={singleParentType} onChange={(e) => setSingleParentType(e.target.value as any)} className={fieldClass}>
                  <option value="">{t("students.form.singleParentTypeUnset")}</option>
                  <option value="mother">{t("students.form.singleParentMother")}</option>
                  <option value="father">{t("students.form.singleParentFather")}</option>
                </select>
              </label>
            ) : null}

            <div className="col-span-full grid gap-x-6 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
              {parentAliveStatus === "both" || parentAliveStatus === "one" ? (
                <>
                  <label className="block animate-in fade-in">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">
                      {parentAliveStatus === "one" && singleParentType
                        ? t("students.form.parentFullNameSingle").replace("{parent}", singleParentType === "mother" ? t("students.form.singleParentMother") : t("students.form.singleParentFather"))
                        : t("students.form.parentFullName")} <span className="text-rose-500">*</span>
                    </span>
                    <input required value={parentFullName} onChange={(e) => setParentFullName(e.target.value)} className={fieldClass} autoComplete="name" />
                  </label>
                  <label className="block animate-in fade-in">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">
                      {parentAliveStatus === "one" && singleParentType
                        ? t("students.form.parentPhoneSingle").replace("{parent}", singleParentType === "mother" ? t("students.form.singleParentMother") : t("students.form.singleParentFather"))
                        : t("students.form.parentPhone")} <span className="text-rose-500">*</span>
                    </span>
                    <input type="tel" required minLength={10} maxLength={13} value={parentPhone} onChange={(e) => setParentPhone(e.target.value.replace(/[^\d+]/g, ''))} className={fieldClass} autoComplete="tel" />
                  </label>
                  <label className="block animate-in fade-in">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">
                      {parentAliveStatus === "one" && singleParentType
                        ? t("students.form.parentEmailSingle").replace("{parent}", singleParentType === "mother" ? t("students.form.singleParentMother") : t("students.form.singleParentFather"))
                        : t("students.form.parentEmail")}
                    </span>
                    <input type="email" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={fieldClass} autoComplete="email" />
                  </label>
                  <label className="block animate-in fade-in col-span-full lg:col-span-2">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">
                      {parentAliveStatus === "one" && singleParentType
                        ? t("students.form.parentAddressSingle").replace("{parent}", singleParentType === "mother" ? t("students.form.singleParentMother") : t("students.form.singleParentFather"))
                        : t("students.form.parentAddress")} <span className="text-rose-500">*</span>
                    </span>
                    <input required value={parentAddress} onChange={(e) => setParentAddress(e.target.value)} className={fieldClass} autoComplete="street-address" />
                  </label>
                </>
              ) : null}

              {parentAliveStatus === "none" ? (
                <>
                  <label className="block animate-in fade-in">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.guardianName")} <span className="text-rose-500">*</span></span>
                    <input required value={guardianName} onChange={(e) => setGuardianName(e.target.value)} className={fieldClass} autoComplete="name" />
                  </label>
                  <label className="block animate-in fade-in">
                    <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.guardianPhone")} <span className="text-rose-500">*</span></span>
                    <input type="tel" required minLength={10} maxLength={13} value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value.replace(/[^\d+]/g, ''))} className={fieldClass} autoComplete="tel" />
                  </label>
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Section 4: Emergency & Medical Information */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">4</span>
              Emergency & Medical Details
            </h3>
          </div>
          <div className="grid gap-x-6 gap-y-6 p-8 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.emergencyContactName")} <span className="text-rose-500">*</span></span>
              <input required value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className={fieldClass} autoComplete="name" />
            </label>
            <label className="block">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.emergencyContactPhone")} <span className="text-rose-500">*</span></span>
              <input type="tel" required minLength={10} maxLength={13} value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value.replace(/[^\d+]/g, ''))} className={fieldClass} autoComplete="tel" />
            </label>
            <div className="hidden lg:block"></div>

            <label className="block col-span-full lg:col-span-1">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.specialNeeds")}</span>
              <textarea value={specialNeeds} onChange={(e) => setSpecialNeeds(e.target.value)} className={`${fieldClass} min-h-[96px] resize-none`} placeholder={t("students.form.specialNeedsPlaceholder")} />
            </label>
            <label className="block col-span-full lg:col-span-1">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.residenceAddress")} <span className="text-rose-500">*</span></span>
              <textarea required value={residenceAddress} onChange={(e) => setResidenceAddress(e.target.value)} className={`${fieldClass} min-h-[96px] resize-none`} placeholder={t("students.form.residenceAddressPlaceholder")} />
            </label>
            <label className="block col-span-full lg:col-span-1">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">{t("students.form.medicalInfo")}</span>
              <textarea value={medicalInfo} onChange={(e) => setMedicalInfo(e.target.value)} className={`${fieldClass} min-h-[96px] resize-none`} placeholder={t("students.form.medicalInfoPlaceholder")} />
            </label>
            <label className="block col-span-full lg:col-span-1">
              <span className="block text-xs font-semibold text-slate-600 mb-1.5">More Information</span>
              <textarea required value={moreInformation} onChange={(e) => setMoreInformation(e.target.value)} className={`${fieldClass} min-h-[96px] resize-none`} placeholder="Any other information about the student / family that you want to share with us. This will not be shared with the student." />
            </label>
          </div>
        </div>

        {/* Section 5: Student Photograph */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md">
          <div className="border-b border-slate-100 bg-slate-50/50 px-8 py-5">
            <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 text-sm font-bold text-purple-700">5</span>
              Student Passport Photo
            </h3>
          </div>
          <div className="p-8">
            <label className="relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 transition-colors hover:border-indigo-400 hover:bg-indigo-50">
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="rounded-full bg-white p-3 shadow-sm ring-1 ring-slate-900/5">
                  <svg className="h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-indigo-600 hover:text-indigo-500">{t("students.photo.labelAdmission")}</span>
                  <span className="text-sm text-slate-500"> or drag and drop</span>
                  <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP up to 5MB</p>
                </div>
                {photoFile && (
                  <div className="mt-4 flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-1.5 text-sm font-semibold text-emerald-800">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {photoFile.name}
                  </div>
                )}
              </div>
              <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
        </div>

        {/* Sticky Form Actions */}
        <div className="sticky bottom-6 z-20 flex flex-wrap items-center justify-end gap-4 rounded-3xl border border-slate-200/60 bg-white/80 px-8 py-5 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl">
          <button type="button" disabled={submitting} onClick={() => { resetForm(); setFormError(null); setFormSuccess(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="rounded-full bg-slate-100 px-8 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-200 focus:ring-4 focus:ring-slate-200 disabled:opacity-50">
            {t("students.form.cancelAdmission")}
          </button>
          <button type="submit" disabled={submitting} className="flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-10 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-blue-500 hover:shadow-indigo-500/40 focus:ring-4 focus:ring-indigo-600/20 disabled:opacity-60 active:scale-95">
            {submitting ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t("students.form.saving")}
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                {t("students.form.submit")}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
