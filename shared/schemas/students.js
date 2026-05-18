import { z } from "zod";
import { nullableTrimmed, optionalPositiveInt, optionalTrimmed, requiredTrimmed, } from "./common.js";
export const studentSortBySchema = z.enum(["date", "id", "name", "class", "boarding"]);
export const studentSortDirSchema = z.enum(["asc", "desc"]);
const studentListBoardingFilterSchema = z.enum(["boarding", "day_half", "day_full"]);
export const studentListQuerySchema = z.object({
    q: optionalTrimmed(200),
    sortBy: studentSortBySchema.default("date"),
    sortDir: studentSortDirSchema.default("desc"),
    classRoomId: optionalPositiveInt(),
    boardingStatus: z.preprocess((value) => {
        if (value === undefined || value === null || value === "")
            return undefined;
        if (typeof value !== "string")
            return value;
        const v = value.trim().toLowerCase();
        return v.length > 0 ? v : undefined;
    }, studentListBoardingFilterSchema.optional()),
    limit: z.preprocess((value) => {
        if (value === undefined || value === null || value === "")
            return 50;
        const n = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(n))
            return 50;
        return Math.min(200, Math.max(1, Math.floor(n)));
    }, z.number().int().min(1).max(200)),
    offset: z.preprocess((value) => {
        if (value === undefined || value === null || value === "")
            return 0;
        const n = typeof value === "number" ? value : Number(value);
        if (!Number.isFinite(n))
            return 0;
        return Math.max(0, Math.floor(n));
    }, z.number().int().min(0)).default(0),
});
const registrationTypeSchema = z.preprocess((value) => {
    if (typeof value !== "string")
        return value;
    const raw = value.trim().toLowerCase();
    if (raw === "transfer" || raw === "transfer_in" || raw === "transfer-in")
        return "continuing";
    if (raw === "first_registration" || raw === "new" || raw === "new_admission")
        return "first";
    return raw;
}, z.enum(["first", "continuing"]));
const transferReasonSchema = z.preprocess((value) => {
    if (typeof value !== "string")
        return value;
    return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}, z.enum(["relocation", "discipline", "better_education"]));
const parentAliveStatusSchema = z.preprocess((value) => {
    if (typeof value !== "string")
        return value;
    const raw = value.trim().toLowerCase();
    if (raw === "alive")
        return "both";
    if (raw === "single")
        return "one";
    if (raw === "deceased" || raw === "guardian")
        return "none";
    return raw;
}, z.enum(["both", "one", "none"]));
const boardingStatusSchema = z.preprocess((value) => {
    if (typeof value !== "string")
        return value;
    const raw = value.trim().toLowerCase();
    if (raw === "day" || raw === "day_scholar")
        return "day_full";
    if (raw === "dayhalf" || raw === "half_day" || raw === "halfday")
        return "day_half";
    if (raw === "dayfull" || raw === "full_day" || raw === "fullday")
        return "day_full";
    return raw;
}, z.enum(["boarding", "day_half", "day_full"]));
const countryCodeSchema = z.preprocess((value) => {
    if (value === undefined || value === null || value === "")
        return value;
    if (typeof value !== "string")
        return value;
    return value.trim().toUpperCase();
}, z.string().min(2).max(10));
export const studentCreateBodySchema = z.object({
    firstName: requiredTrimmed(100, "firstName is required"),
    middleName: optionalTrimmed(100),
    lastName: requiredTrimmed(100, "lastName is required"),
    dateOfBirth: optionalTrimmed(32),
    parentEmail: optionalTrimmed(255),
    classRoomId: optionalPositiveInt(),
    gender: optionalTrimmed(20),
    sectionName: optionalTrimmed(80),
    nationality: optionalTrimmed(100),
    countryCode: countryCodeSchema.nullable().optional(),
    district: optionalTrimmed(120),
    registrationType: registrationTypeSchema.optional(),
    previousSchool: optionalTrimmed(200),
    previousSchoolLocation: optionalTrimmed(200),
    lastClassAttended: optionalTrimmed(120),
    lastTermYear: optionalTrimmed(40),
    previousGrades: optionalTrimmed(8000),
    transferReason: transferReasonSchema.optional(),
    parentAliveStatus: parentAliveStatusSchema.optional(),
    parentFullName: optionalTrimmed(120),
    parentPhone: optionalTrimmed(32),
    parentAddress: optionalTrimmed(255),
    religion: optionalTrimmed(80),
    specialNeeds: optionalTrimmed(255),
    boardingStatus: boardingStatusSchema.optional(),
    residenceAddress: optionalTrimmed(255),
    medicalInfo: optionalTrimmed(2000),
    emergencyContactName: optionalTrimmed(120),
    emergencyContactPhone: optionalTrimmed(32),
    guardianName: optionalTrimmed(120),
    guardianPhone: optionalTrimmed(32),
});
export const studentUpdateBodySchema = z.object({
    firstName: optionalTrimmed(100),
    middleName: nullableTrimmed(100),
    lastName: optionalTrimmed(100),
    dateOfBirth: nullableTrimmed(32),
    parentEmail: nullableTrimmed(255),
    classRoomId: optionalPositiveInt(),
    gender: nullableTrimmed(20),
    sectionName: nullableTrimmed(80),
    nationality: nullableTrimmed(100),
    countryCode: countryCodeSchema.nullable().optional(),
    district: nullableTrimmed(120),
    registrationType: registrationTypeSchema.optional(),
    previousSchool: nullableTrimmed(200),
    previousSchoolLocation: nullableTrimmed(200),
    lastClassAttended: nullableTrimmed(120),
    lastTermYear: nullableTrimmed(40),
    previousGrades: nullableTrimmed(8000),
    transferReason: transferReasonSchema.nullable().optional(),
    parentAliveStatus: parentAliveStatusSchema.nullable().optional(),
    parentFullName: nullableTrimmed(120),
    parentPhone: nullableTrimmed(32),
    parentAddress: nullableTrimmed(255),
    religion: nullableTrimmed(80),
    specialNeeds: nullableTrimmed(255),
    boardingStatus: boardingStatusSchema.nullable().optional(),
    residenceAddress: nullableTrimmed(255),
    medicalInfo: nullableTrimmed(2000),
    emergencyContactName: nullableTrimmed(120),
    emergencyContactPhone: nullableTrimmed(32),
    guardianName: nullableTrimmed(120),
    guardianPhone: nullableTrimmed(32),
});
//# sourceMappingURL=students.js.map