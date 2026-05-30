import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  fetchCountries,
  fetchDistricts,
  fetchNationalities,
  type CountryOption,
} from "../../api/geo";
import {
  createStudent,
  fetchClassSections,
  fetchClassrooms,
  uploadStudentPhoto,
  type ClassRoomOption,
} from "../../api/students";
import { fetchStudentStatuses, type StudentStatusRow } from "../../api/studentStatuses";
import { fetchGeneralSettings } from "../../api/settingsGeneral";
import { FeePreviewPanel } from "../fees/FeePreviewPanel";
import { useI18n } from "../../i18n/I18nProvider";
import { useTermContext } from "../../context/TermContext";
import "../../styles/fee-config-theme.css";

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

const registrationSchema = z
  .object({
    firstName: z.string().trim().min(1, "First name is required"),
    middleName: z.string().optional(),
    lastName: z.string().trim().min(1, "Last name is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.string().min(1, "Gender is required"),
    religion: z.string().min(1, "Religion is required"),
    nationality: z.string().min(1, "Nationality is required"),
    countryCode: z.string().min(2, "Country is required"),
    district: z.string().optional(),
    registrationType: z.enum(["first", "continuing"], { message: "Registration type is required" }),
    transferReason: z
      .enum(["relocation", "discipline", "better_education"])
      .optional(),
    classRoomId: z.number({ message: "Class is required" }).positive(),
    studentStatusId: z.number({ message: "Student status is required" }).positive(),
    parentAliveStatus: z.enum(["both", "one", "none"], { message: "Parent status is required" }),
    singleParentType: z.enum(["mother", "father", ""]).optional(),
    parentFullName: z.string().optional(),
    parentPhone: z.string().optional(),
    parentEmail: z.string().optional(),
    parentAddress: z.string().optional(),
    guardianName: z.string().optional(),
    guardianPhone: z.string().optional(),
    emergencyContactName: z.string().trim().min(1, "Emergency contact name is required"),
    emergencyContactPhone: z
      .string()
      .trim()
      .min(10, "Emergency contact phone is required"),
    residenceAddress: z.string().trim().min(1, "Residence address is required"),
    specialNeeds: z.string().optional(),
    medicalInfo: z.string().optional(),
    moreInformation: z.string().trim().min(1, "More information is required"),
  })
  .superRefine((data, ctx) => {
    if (data.registrationType === "continuing" && !data.transferReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Transfer reason is required for transfer students",
        path: ["transferReason"],
      });
    }
    if (data.parentAliveStatus === "both" || data.parentAliveStatus === "one") {
      if (!data.parentFullName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Parent / guardian name is required",
          path: ["parentFullName"],
        });
      }
      if (!data.parentPhone?.trim() || data.parentPhone.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Valid parent phone is required",
          path: ["parentPhone"],
        });
      }
      if (!data.parentAddress?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Parent address is required",
          path: ["parentAddress"],
        });
      }
      if (data.parentAliveStatus === "one" && !data.singleParentType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Specify which parent is available",
          path: ["singleParentType"],
        });
      }
    }
    if (data.parentAliveStatus === "none") {
      if (!data.guardianName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Guardian name is required",
          path: ["guardianName"],
        });
      }
      if (!data.guardianPhone?.trim() || data.guardianPhone.trim().length < 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Valid guardian phone is required",
          path: ["guardianPhone"],
        });
      }
    }
  });

type FormValues = z.infer<typeof registrationSchema>;

const STEPS = [
  { id: 1, title: "Personal Information", hint: "Basic identity and location details for the learner." },
  { id: 2, title: "Academic Details", hint: "Class placement and fee-related student status." },
  { id: 3, title: "Parent / Guardian", hint: "Who is responsible for this student at home." },
  { id: 4, title: "Emergency & Medical", hint: "Safety contacts, health notes, and residence." },
  { id: 5, title: "Passport Photo", hint: "Optional photo for the student profile." },
  { id: 6, title: "Fees & Submit", hint: "Review term fees from your fee rules, then complete registration." },
] as const;

const STEP_FIELDS: Record<number, (keyof FormValues)[]> = {
  1: ["firstName", "lastName", "dateOfBirth", "gender", "religion", "nationality", "countryCode"],
  2: ["registrationType", "transferReason", "classRoomId", "studentStatusId"],
  3: [
    "parentAliveStatus",
    "singleParentType",
    "parentFullName",
    "parentPhone",
    "parentEmail",
    "parentAddress",
    "guardianName",
    "guardianPhone",
  ],
  4: [
    "emergencyContactName",
    "emergencyContactPhone",
    "residenceAddress",
    "moreInformation",
    "specialNeeds",
    "medicalInfo",
  ],
  5: [],
  6: ["studentStatusId"],
};

function SectionCard({
  stepNum,
  title,
  hint,
  children,
  tone,
}: {
  stepNum: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 sm:px-8">
        <h3 className="flex items-center gap-3 text-lg font-bold text-slate-800">
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${tone}`}
          >
            {stepNum}
          </span>
          {title}
        </h3>
        {hint ? <p className="mt-2 text-sm text-slate-500 pl-11">{hint}</p> : null}
      </div>
      <div className="grid gap-x-6 gap-y-6 p-6 sm:grid-cols-2 lg:grid-cols-3 sm:p-8">{children}</div>
    </div>
  );
}

function FieldLabel({
  children,
  required,
  description,
}: {
  children: React.ReactNode;
  required?: boolean;
  description?: string;
}) {
  return (
    <span className="block text-xs font-semibold text-slate-600 mb-1.5">
      {children}
      {required ? <span className="text-rose-500"> *</span> : null}
      {description ? (
        <span className="mt-0.5 block font-normal text-slate-400">{description}</span>
      ) : null}
    </span>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-rose-600">{message}</p>;
}

export function StudentRegistrationWizard({ onCreated }: { onCreated: () => void }) {
  const { t } = useI18n();
  const { viewingTerm, viewingAcademicYear } = useTermContext();
  const [step, setStep] = useState(1);
  const [rooms, setRooms] = useState<ClassRoomOption[]>([]);
  const [statuses, setStatuses] = useState<StudentStatusRow[]>([]);
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [sectionsStreamsEnabled, setSectionsStreamsEnabled] = useState(false);
  const [sectionName, setSectionName] = useState("");
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lastAutoNationalityRef = useRef<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      registrationType: "first",
      parentAliveStatus: "both",
      singleParentType: "",
      countryCode: "UG",
      district: "",
    },
    mode: "onTouched",
  });

  const {
    register,
    watch,
    setValue,
    trigger,
    handleSubmit,
    formState: { errors },
  } = form;

  const countryCode = watch("countryCode");
  const classRoomId = watch("classRoomId");
  const parentAliveStatus = watch("parentAliveStatus");
  const registrationType = watch("registrationType");
  const studentStatusId = watch("studentStatusId");

  const activeRooms = useMemo(
    () =>
      [...rooms.filter((r) => r.isActive !== false)].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [rooms],
  );

  const selectedClassRoom = useMemo(() => {
    const id = Number(classRoomId);
    if (!Number.isFinite(id) || id <= 0) return null;
    return rooms.find((r) => r.id === id) ?? null;
  }, [classRoomId, rooms]);

  const sortedNationalities = useMemo(
    () => [...nationalities].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [nationalities],
  );

  const sortedCountries = useMemo(
    () =>
      [...countries].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [countries],
  );

  const countryCodeToName = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of countries) map.set(c.code.trim().toUpperCase(), c.name);
    return map;
  }, [countries]);

  const nationalityLookup = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of nationalities) {
      const key = n.trim().toLowerCase();
      if (key && !map.has(key)) map.set(key, n);
    }
    return map;
  }, [nationalities]);

  useEffect(() => {
    void Promise.all([
      fetchClassrooms().then(setRooms),
      fetchStudentStatuses().then(setStatuses),
      fetchNationalities().then(setNationalities),
      fetchCountries().then(setCountries),
      fetchGeneralSettings().then((s) =>
        setSectionsStreamsEnabled((s.classes_sections_streams_enabled ?? "yes") === "yes"),
      ),
    ]).catch(() => setError("Failed to load form reference data"));
  }, []);

  useEffect(() => {
    const code = (countryCode ?? "").trim().toUpperCase();
    if (!code) {
      setDistricts([]);
      setValue("district", "");
      return;
    }
    let cancelled = false;
    setDistrictsLoading(true);
    void fetchDistricts(code)
      .then((list) => {
        if (!cancelled) {
          setDistricts(list);
          const current = form.getValues("district");
          if (current && !list.includes(current)) setValue("district", "");
        }
      })
      .catch(() => {
        if (!cancelled) setDistricts([]);
      })
      .finally(() => {
        if (!cancelled) setDistrictsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, setValue, form]);

  useEffect(() => {
    const code = (countryCode ?? "").trim().toUpperCase();
    if (!code) return;
    const countryName = countryCodeToName.get(code);
    if (!countryName) return;
    const demonymByCountry: Record<string, string> = {
      uganda: "Ugandan",
      kenya: "Kenyan",
      tanzania: "Tanzanian",
      rwanda: "Rwandan",
      burundi: "Burundian",
    };
    const proposed = demonymByCountry[countryName.trim().toLowerCase()];
    if (!proposed) return;
    const exact = nationalityLookup.get(proposed.trim().toLowerCase());
    if (!exact) return;
    const current = form.getValues("nationality")?.trim() ?? "";
    const lastAuto = (lastAutoNationalityRef.current ?? "").trim();
    const canAutoReplace = !current || current === lastAuto;
    if (!canAutoReplace) return;
    lastAutoNationalityRef.current = exact;
    setValue("nationality", exact);
  }, [countryCode, countryCodeToName, nationalityLookup, setValue, form]);

  useEffect(() => {
    if (!sectionsStreamsEnabled || !classRoomId) {
      setSectionName("");
      return;
    }
    let cancelled = false;
    setSectionsLoading(true);
    void fetchClassSections(classRoomId)
      .then((list) => {
        if (!cancelled) setSectionName(list[0]?.name ?? "");
      })
      .catch(() => {
        if (!cancelled) setSectionName("");
      })
      .finally(() => {
        if (!cancelled) setSectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [classRoomId, sectionsStreamsEnabled]);

  async function goNext() {
    setError(null);
    const fields = STEP_FIELDS[step] ?? [];
    const ok = fields.length === 0 ? true : await trigger(fields);
    if (!ok) {
      setError("Please complete all required fields on this step before continuing.");
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function goBack() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(values: FormValues) {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const medicalParts = [values.medicalInfo?.trim(), values.moreInformation?.trim()]
        .filter(Boolean)
        .join("\n\n");
      const created = await createStudent({
        firstName: values.firstName.trim(),
        middleName: values.middleName?.trim() || undefined,
        lastName: values.lastName.trim(),
        dateOfBirth: values.dateOfBirth,
        parentEmail:
          values.parentAliveStatus === "none" ? undefined : values.parentEmail?.trim() || undefined,
        classRoomId: values.classRoomId,
        gender: values.gender,
        sectionName: sectionName.trim() || undefined,
        nationality: values.nationality,
        countryCode: values.countryCode,
        district: values.district?.trim() || undefined,
        registrationType: values.registrationType,
        transferReason:
          values.registrationType === "continuing" && values.transferReason
            ? values.transferReason
            : undefined,
        parentAliveStatus: values.parentAliveStatus,
        parentFullName:
          values.parentAliveStatus === "none"
            ? undefined
            : values.parentFullName?.trim() || undefined,
        parentPhone:
          values.parentAliveStatus === "none" ? undefined : values.parentPhone?.trim() || undefined,
        parentAddress:
          values.parentAliveStatus === "none"
            ? undefined
            : values.parentAddress?.trim() || undefined,
        religion: values.religion,
        specialNeeds: values.specialNeeds?.trim() || undefined,
        studentStatusId: values.studentStatusId,
        residenceAddress: values.residenceAddress.trim(),
        medicalInfo: medicalParts || undefined,
        emergencyContactName: values.emergencyContactName.trim(),
        emergencyContactPhone: values.emergencyContactPhone.trim(),
        guardianName:
          values.parentAliveStatus === "none"
            ? values.guardianName?.trim() || undefined
            : undefined,
        guardianPhone:
          values.parentAliveStatus === "none"
            ? values.guardianPhone?.trim() || undefined
            : undefined,
      });

      if (photoFile) {
        try {
          await uploadStudentPhoto(created.id, photoFile);
        } catch {
          setSuccess(
            `${t("students.form.success")} ${t("students.photo.uploadLaterHint")} (${created.admissionNumber})`,
          );
          onCreated();
          form.reset();
          setStep(1);
          setPhotoFile(null);
          return;
        }
      }

      setSuccess(
        `${t("students.form.success")} (${t("students.form.admissionNumberLabel")}: ${created.admissionNumber}).`,
      );
      onCreated();
      form.reset();
      setStep(1);
      setPhotoFile(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("students.form.error"));
    } finally {
      setBusy(false);
    }
  }

  const currentStep = STEPS[step - 1];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 px-8 py-10 shadow-xl sm:px-12">
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t("students.form.title")}
          </h2>
          <p className="mt-3 max-w-2xl text-base text-indigo-200">
            Register a new student in {STEPS.length} guided steps. Required fields are marked with *
            — you cannot continue until each step is complete.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              s.id === step
                ? "bg-indigo-600 text-white"
                : s.id < step
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {s.id}. {s.title}
          </div>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-4 text-sm font-medium text-rose-800">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-sm font-medium text-emerald-800">
          {success}
        </div>
      ) : null}

      <p className="text-sm font-semibold text-slate-600">
        Step {step} of {STEPS.length}: {currentStep?.title}
      </p>
      {currentStep?.hint ? <p className="text-sm text-slate-500 -mt-4">{currentStep.hint}</p> : null}

      <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
        {step === 1 ? (
          <SectionCard stepNum={1} title="Personal Information" tone="bg-indigo-100 text-indigo-700">
            <label className="block">
              <FieldLabel required>{t("students.form.firstName")}</FieldLabel>
              <input className={fieldClass} {...register("firstName")} placeholder="E.g. John" />
              <FieldError message={errors.firstName?.message} />
            </label>
            <label className="block">
              <FieldLabel>{t("students.form.middleName")}</FieldLabel>
              <input className={fieldClass} {...register("middleName")} placeholder="Optional" />
            </label>
            <label className="block">
              <FieldLabel required>{t("students.form.lastName")}</FieldLabel>
              <input className={fieldClass} {...register("lastName")} placeholder="E.g. Doe" />
              <FieldError message={errors.lastName?.message} />
            </label>
            <label className="block">
              <FieldLabel required>{t("students.form.dob")}</FieldLabel>
              <input type="date" className={fieldClass} {...register("dateOfBirth")} />
              <FieldError message={errors.dateOfBirth?.message} />
            </label>
            <label className="block">
              <FieldLabel required>{t("students.form.gender")}</FieldLabel>
              <select className={fieldClass} {...register("gender")}>
                <option value="">{t("students.form.genderUnset")}</option>
                <option value="Female">{t("students.form.genderFemale")}</option>
                <option value="Male">{t("students.form.genderMale")}</option>
                <option value="Other">{t("students.form.genderOther")}</option>
              </select>
              <FieldError message={errors.gender?.message} />
            </label>
            <label className="block">
              <FieldLabel required>{t("students.form.religion")}</FieldLabel>
              <select className={fieldClass} {...register("religion")}>
                <option value="">{t("students.form.religionUnset")}</option>
                {religions.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <FieldError message={errors.religion?.message} />
            </label>
            <label className="block">
              <FieldLabel required>{t("students.form.nationality")}</FieldLabel>
              <select
                className={fieldClass}
                {...register("nationality", {
                  onChange: () => {
                    lastAutoNationalityRef.current = null;
                  },
                })}
              >
                <option value="">{t("students.form.nationalityUnset")}</option>
                {sortedNationalities.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <FieldError message={errors.nationality?.message} />
            </label>
            <label className="block">
              <FieldLabel required>{t("students.form.country")}</FieldLabel>
              <select className={fieldClass} {...register("countryCode")}>
                <option value="">{t("students.form.countryUnset")}</option>
                {sortedCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
              <FieldError message={errors.countryCode?.message} />
            </label>
            <label className="block">
              <FieldLabel description="Optional unless your school policy requires it">
                {t("students.form.district")}
              </FieldLabel>
              <select
                className={fieldClass}
                {...register("district")}
                disabled={!countryCode?.trim() || districtsLoading}
              >
                <option value="">
                  {!countryCode?.trim()
                    ? t("students.form.districtPickCountry")
                    : districtsLoading
                      ? t("students.form.districtLoading")
                      : t("students.form.districtUnset")}
                </option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </SectionCard>
        ) : null}

        {step === 2 ? (
          <SectionCard stepNum={2} title="Academic Details" tone="bg-sky-100 text-sky-700">
            <label className="block">
              <FieldLabel required>{t("students.form.registrationType")}</FieldLabel>
              <select className={fieldClass} {...register("registrationType")}>
                <option value="first">{t("students.form.registrationNewAdmission")}</option>
                <option value="continuing">{t("students.form.registrationTransferIn")}</option>
              </select>
              <FieldError message={errors.registrationType?.message} />
            </label>
            {registrationType === "continuing" ? (
              <label className="block">
                <FieldLabel required>{t("students.form.transferReason")}</FieldLabel>
                <select className={fieldClass} {...register("transferReason")}>
                  <option value="">{t("students.form.transferReasonUnset")}</option>
                  <option value="relocation">{t("students.form.transferReasonRelocation")}</option>
                  <option value="discipline">{t("students.form.transferReasonDiscipline")}</option>
                  <option value="better_education">
                    {t("students.form.transferReasonBetterEducation")}
                  </option>
                </select>
                <FieldError message={errors.transferReason?.message} />
              </label>
            ) : (
              <div className="hidden sm:block" />
            )}
            <label className="block">
              <FieldLabel required>{t("students.form.classroom")}</FieldLabel>
              <select
                className={fieldClass}
                {...register("classRoomId", { valueAsNumber: true })}
              >
                <option value="">{t("students.form.classroomUnset")}</option>
                {activeRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.academicYear ? ` (${r.academicYear})` : ""}
                  </option>
                ))}
              </select>
              <FieldError message={errors.classRoomId?.message} />
            </label>
            <div className="block">
              <FieldLabel>Class category</FieldLabel>
              <div className={`${fieldClass} flex min-h-[44px] items-center bg-slate-50 text-slate-700`}>
                {!classRoomId
                  ? "Select class first"
                  : selectedClassRoom?.categoryName || "No category assigned"}
              </div>
            </div>
            {sectionsStreamsEnabled ? (
              <div className="block">
                <FieldLabel>{t("students.form.section")}</FieldLabel>
                <div className={`${fieldClass} flex min-h-[44px] items-center bg-slate-50 text-slate-700`}>
                  {!classRoomId
                    ? t("students.form.sectionPickClass")
                    : sectionsLoading
                      ? t("students.form.sectionLoading")
                      : sectionName || t("students.form.sectionNoData")}
                </div>
              </div>
            ) : (
              <div className="hidden lg:block" />
            )}
            <label className="block sm:col-span-2">
              <FieldLabel
                required
                description="Used by the fee rules engine to calculate term fees (replaces legacy boarding fee structure)."
              >
                Student status
              </FieldLabel>
              <select
                className={fieldClass}
                {...register("studentStatusId", { valueAsNumber: true })}
              >
                <option value="">Select student status…</option>
                {statuses
                  .filter((s) => !s.archivedAt)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
              </select>
              <FieldError message={errors.studentStatusId?.message} />
            </label>
          </SectionCard>
        ) : null}

        {step === 3 ? (
          <SectionCard stepNum={3} title="Parent / Guardian Details" tone="bg-emerald-100 text-emerald-700">
            <label className="block col-span-full sm:col-span-1">
              <FieldLabel required>{t("students.form.parentAliveStatus")}</FieldLabel>
              <select
                className={fieldClass}
                {...register("parentAliveStatus", {
                  onChange: (e) => {
                    const v = e.target.value as FormValues["parentAliveStatus"];
                    if (v === "none") {
                      setValue("parentFullName", "");
                      setValue("parentPhone", "");
                      setValue("parentEmail", "");
                      setValue("parentAddress", "");
                    } else {
                      setValue("guardianName", "");
                      setValue("guardianPhone", "");
                    }
                    if (v !== "one") setValue("singleParentType", "");
                  },
                })}
              >
                <option value="">{t("students.form.parentAliveUnset")}</option>
                <option value="both">{t("students.form.parentAliveBoth")}</option>
                <option value="one">{t("students.form.parentAliveOne")}</option>
                <option value="none">{t("students.form.parentAliveNone")}</option>
              </select>
              <FieldError message={errors.parentAliveStatus?.message} />
            </label>
            {parentAliveStatus === "one" ? (
              <label className="block">
                <FieldLabel required>{t("students.form.singleParentType")}</FieldLabel>
                <select className={fieldClass} {...register("singleParentType")}>
                  <option value="">{t("students.form.singleParentTypeUnset")}</option>
                  <option value="mother">{t("students.form.singleParentMother")}</option>
                  <option value="father">{t("students.form.singleParentFather")}</option>
                </select>
                <FieldError message={errors.singleParentType?.message} />
              </label>
            ) : null}
            {(parentAliveStatus === "both" || parentAliveStatus === "one") && (
              <>
                <label className="block">
                  <FieldLabel required>{t("students.form.parentFullName")}</FieldLabel>
                  <input className={fieldClass} {...register("parentFullName")} />
                  <FieldError message={errors.parentFullName?.message} />
                </label>
                <label className="block">
                  <FieldLabel required>{t("students.form.parentPhone")}</FieldLabel>
                  <input
                    type="tel"
                    className={fieldClass}
                    {...register("parentPhone")}
                    minLength={10}
                  />
                  <FieldError message={errors.parentPhone?.message} />
                </label>
                <label className="block">
                  <FieldLabel>{t("students.form.parentEmail")}</FieldLabel>
                  <input type="email" className={fieldClass} {...register("parentEmail")} />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel required>{t("students.form.parentAddress")}</FieldLabel>
                  <input className={fieldClass} {...register("parentAddress")} />
                  <FieldError message={errors.parentAddress?.message} />
                </label>
              </>
            )}
            {parentAliveStatus === "none" && (
              <>
                <label className="block">
                  <FieldLabel required>{t("students.form.guardianName")}</FieldLabel>
                  <input className={fieldClass} {...register("guardianName")} />
                  <FieldError message={errors.guardianName?.message} />
                </label>
                <label className="block">
                  <FieldLabel required>{t("students.form.guardianPhone")}</FieldLabel>
                  <input
                    type="tel"
                    className={fieldClass}
                    {...register("guardianPhone")}
                    minLength={10}
                  />
                  <FieldError message={errors.guardianPhone?.message} />
                </label>
              </>
            )}
          </SectionCard>
        ) : null}

        {step === 4 ? (
          <SectionCard
            stepNum={4}
            title="Emergency & Medical Details"
            tone="bg-rose-100 text-rose-700"
          >
            <label className="block">
              <FieldLabel required>{t("students.form.emergencyContactName")}</FieldLabel>
              <input className={fieldClass} {...register("emergencyContactName")} />
              <FieldError message={errors.emergencyContactName?.message} />
            </label>
            <label className="block">
              <FieldLabel required>{t("students.form.emergencyContactPhone")}</FieldLabel>
              <input
                type="tel"
                className={fieldClass}
                {...register("emergencyContactPhone")}
                minLength={10}
              />
              <FieldError message={errors.emergencyContactPhone?.message} />
            </label>
            <label className="block col-span-full lg:col-span-1">
              <FieldLabel required>{t("students.form.residenceAddress")}</FieldLabel>
              <textarea
                className={`${fieldClass} min-h-[96px] resize-none`}
                {...register("residenceAddress")}
                placeholder={t("students.form.residenceAddressPlaceholder")}
              />
              <FieldError message={errors.residenceAddress?.message} />
            </label>
            <label className="block col-span-full lg:col-span-1">
              <FieldLabel>{t("students.form.specialNeeds")}</FieldLabel>
              <textarea
                className={`${fieldClass} min-h-[96px] resize-none`}
                {...register("specialNeeds")}
                placeholder={t("students.form.specialNeedsPlaceholder")}
              />
            </label>
            <label className="block col-span-full lg:col-span-1">
              <FieldLabel>{t("students.form.medicalInfo")}</FieldLabel>
              <textarea
                className={`${fieldClass} min-h-[96px] resize-none`}
                {...register("medicalInfo")}
                placeholder={t("students.form.medicalInfoPlaceholder")}
              />
            </label>
            <label className="block col-span-full">
              <FieldLabel
                required
                description="Any other information about the student or family (not shared with the student)."
              >
                More information
              </FieldLabel>
              <textarea
                className={`${fieldClass} min-h-[96px] resize-none`}
                {...register("moreInformation")}
              />
              <FieldError message={errors.moreInformation?.message} />
            </label>
          </SectionCard>
        ) : null}

        {step === 5 ? (
          <SectionCard stepNum={5} title="Student Passport Photo" tone="bg-purple-100 text-purple-700">
            <div className="col-span-full">
              <p className="text-sm text-slate-600 mb-4">
                Upload a passport-style photo for the student profile. This step is optional — you
                can add a photo later from the student profile.
              </p>
              <label className="relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 py-10 hover:border-indigo-400 hover:bg-indigo-50">
                <span className="text-sm font-bold text-indigo-600">
                  {t("students.photo.labelAdmission")}
                </span>
                <span className="text-sm text-slate-500"> or drag and drop</span>
                <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP up to 5MB</p>
                {photoFile ? (
                  <p className="mt-3 text-sm font-semibold text-emerald-700">{photoFile.name}</p>
                ) : null}
                <input
                  type="file"
                  className="sr-only"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </SectionCard>
        ) : null}

        {step === 6 ? (
          <div className="space-y-6">
            <SectionCard
              stepNum={6}
              title="Fee preview"
              tone="bg-amber-100 text-amber-700"
              hint="Amounts are calculated from your configured fee rules for the selected student status."
            >
              <div className="col-span-full">
                <FeePreviewPanel
                  studentStatusId={studentStatusId ? Number(studentStatusId) : null}
                  term={viewingTerm}
                  academicYear={viewingAcademicYear}
                />
                <FieldError message={errors.studentStatusId?.message} />
              </div>
            </SectionCard>
            <p className="text-sm text-slate-600">
              On submit, the student record is created and fee line items are generated automatically
              for {viewingTerm} ({viewingAcademicYear}).
            </p>
          </div>
        ) : null}

        <div className="sticky bottom-6 z-20 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/60 bg-white/90 px-6 py-5 shadow-lg backdrop-blur-xl">
          <div>
            {step > 1 ? (
              <button
                type="button"
                className="rounded-full bg-slate-100 px-6 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200"
                onClick={goBack}
                disabled={busy}
              >
                Back
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-3">
            {step < STEPS.length ? (
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-md hover:from-indigo-500 disabled:opacity-60"
                onClick={() => void goNext()}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 px-8 py-2.5 text-sm font-bold text-white shadow-md hover:from-indigo-500 disabled:opacity-60"
                disabled={busy}
                onClick={() => {
                  void handleSubmit((values) => submit(values))();
                }}
              >
                {busy ? t("students.form.saving") : t("students.form.submit")}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
