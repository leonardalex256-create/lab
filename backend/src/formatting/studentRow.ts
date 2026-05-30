import { countryNameFromCode } from "../data/geoReference.js";
import type { ClassRoom, Student } from "../models/index.js";
import { safeLocaleDate } from "./localeDate.js";

export type StudentApiRow = {
  id: number;
  admissionNumber: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  fullName: string;
  dateOfBirth: string | null;
  /** DD/MM/YYYY for display */
  dateOfBirthFormatted: string | null;
  parentEmail: string | null;
  classRoomId: number | null;
  className: string | null;
  gender: string | null;
  sectionName: string | null;
  admittedAt: string;
  hasPassportPhoto: boolean;
  nationality: string | null;
  countryCode: string | null;
  countryName: string | null;
  district: string | null;
  /** `first` | `continuing` */
  registrationType: string;
  lastClassAttended: string | null;
  lastTermYear: string | null;
  previousReportCardFilename: string | null;
  previousGrades: string | null;
  transferReason: string | null;
  parentAliveStatus: string | null;
  parentFullName: string | null;
  parentPhone: string | null;
  parentAddress: string | null;
  religion: string | null;
  specialNeeds: string | null;
  boardingStatus: string | null;
  studentStatusId: number | null;
  studentStatusCode: string | null;
  studentStatusName: string | null;
  residenceAddress: string | null;
  medicalInfo: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  bursaryPercentage: number;
  bursaryStartsAt: string | null;
  bursaryEndsAt: string | null;
};

function resolveCreatedAt(s: Student): Date | string | undefined {
  return (
    s.createdAt ??
    (s.get("created_at") as Date | string | undefined) ??
    (s.getDataValue("created_at") as Date | string | undefined)
  );
}

function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

export function studentToApiRow(s: Student): StudentApiRow {
  const cr = s.get("classRoom") as ClassRoom | null | undefined;
  const fn = s.passportPhotoFilename ?? (s.get("passport_photo_filename") as string | null | undefined);
  const cc =
    s.countryCode ?? (s.get("country_code") as string | null | undefined) ?? null;
  const reg =
    s.registrationType ?? (s.get("registration_type") as string | undefined) ?? "first";
  return {
    id: s.id,
    admissionNumber: s.admissionNumber,
    firstName: s.firstName,
    middleName:
      (s.get("middle_name") as string | null | undefined) ??
      (s as unknown as { middleName?: string | null }).middleName ??
      null,
    lastName: s.lastName,
    fullName: [s.firstName, (s.get("middle_name") as string | null | undefined) ?? null, s.lastName]
      .filter(Boolean)
      .join(" "),
    dateOfBirth: s.dateOfBirth ?? null,
    dateOfBirthFormatted: s.dateOfBirth ? safeLocaleDate(s.dateOfBirth) : null,
    parentEmail: s.parentEmail ?? null,
    classRoomId: s.classRoomId ?? null,
    className: cr?.name ?? null,
    gender: s.gender ?? null,
    sectionName: s.sectionName ?? null,
    admittedAt: safeLocaleDate(resolveCreatedAt(s)),
    hasPassportPhoto: Boolean(fn && String(fn).trim() !== ""),
    nationality: s.nationality ?? null,
    countryCode: cc,
    countryName: countryNameFromCode(cc),
    district: s.district ?? null,
    registrationType: reg,
    lastClassAttended:
      (s.get("last_class_attended") as string | null | undefined) ??
      (s as unknown as { lastClassAttended?: string | null }).lastClassAttended ??
      null,
    lastTermYear:
      (s.get("last_term_year") as string | null | undefined) ??
      (s as unknown as { lastTermYear?: string | null }).lastTermYear ??
      null,
    previousReportCardFilename:
      (s.get("previous_report_card_filename") as string | null | undefined) ??
      (s as unknown as { previousReportCardFilename?: string | null }).previousReportCardFilename ??
      null,
    previousGrades:
      (s.get("previous_grades") as string | null | undefined) ??
      (s as unknown as { previousGrades?: string | null }).previousGrades ??
      null,
    transferReason:
      (s.get("transfer_reason") as string | null | undefined) ??
      (s as unknown as { transferReason?: string | null }).transferReason ??
      null,
    parentAliveStatus:
      (s.get("parent_alive_status") as string | null | undefined) ??
      // Keep model-property fallback for runtime compatibility.
      (s as unknown as { parentAliveStatus?: string | null }).parentAliveStatus ??
      null,
    parentFullName:
      (s.get("parent_full_name") as string | null | undefined) ??
      (s as unknown as { parentFullName?: string | null }).parentFullName ??
      null,
    parentPhone:
      (s.get("parent_phone") as string | null | undefined) ??
      (s as unknown as { parentPhone?: string | null }).parentPhone ??
      null,
    parentAddress:
      (s.get("parent_address") as string | null | undefined) ??
      (s as unknown as { parentAddress?: string | null }).parentAddress ??
      null,
    religion:
      (s.get("religion") as string | null | undefined) ??
      (s as unknown as { religion?: string | null }).religion ??
      null,
    specialNeeds:
      (s.get("special_needs") as string | null | undefined) ??
      (s as unknown as { specialNeeds?: string | null }).specialNeeds ??
      null,
    boardingStatus:
      (s.get("boarding_status") as string | null | undefined) ??
      (s as unknown as { boardingStatus?: string | null }).boardingStatus ??
      null,
    studentStatusId:
      s.studentStatusId ??
      (s.get("student_status_id") as number | null | undefined) ??
      null,
    studentStatusCode:
      ((s.get("studentStatus") as { code?: string } | null | undefined)?.code as
        | string
        | undefined) ?? null,
    studentStatusName:
      ((s.get("studentStatus") as { name?: string } | null | undefined)?.name as
        | string
        | undefined) ?? null,
    residenceAddress:
      (s.get("residence_address") as string | null | undefined) ??
      (s as unknown as { residenceAddress?: string | null }).residenceAddress ??
      null,
    medicalInfo:
      (s.get("medical_info") as string | null | undefined) ??
      (s as unknown as { medicalInfo?: string | null }).medicalInfo ??
      null,
    emergencyContactName:
      (s.get("emergency_contact_name") as string | null | undefined) ??
      (s as unknown as { emergencyContactName?: string | null }).emergencyContactName ??
      null,
    emergencyContactPhone:
      (s.get("emergency_contact_phone") as string | null | undefined) ??
      (s as unknown as { emergencyContactPhone?: string | null }).emergencyContactPhone ??
      null,
    guardianName:
      (s.get("guardian_name") as string | null | undefined) ??
      (s as unknown as { guardianName?: string | null }).guardianName ??
      null,
    guardianPhone:
      (s.get("guardian_phone") as string | null | undefined) ??
      (s as unknown as { guardianPhone?: string | null }).guardianPhone ??
      null,
    bursaryPercentage:
      Number(
        (s.get("bursary_percentage") as number | null | undefined) ??
          (s as unknown as { bursaryPercentage?: number | null }).bursaryPercentage ??
          0,
      ) || 0,
    bursaryStartsAt: toIsoOrNull(
      (s.get("bursary_starts_at") as Date | string | null | undefined) ??
        (s as unknown as { bursaryStartsAt?: Date | string | null }).bursaryStartsAt ??
        null,
    ),
    bursaryEndsAt: toIsoOrNull(
      (s.get("bursary_ends_at") as Date | string | null | undefined) ??
        (s as unknown as { bursaryEndsAt?: Date | string | null }).bursaryEndsAt ??
        null,
    ),
  };
}
