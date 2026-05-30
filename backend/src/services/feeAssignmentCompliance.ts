import { Op } from "sequelize";
import {
  ClassRoom,
  SchoolSetting,
  Student,
  StudentFeeAssignment,
  User,
  UserNotification,
} from "../models/index.js";
import { loadOfficialSchoolTermYear, normalizeOfficialTerm } from "../lib/officialSchoolTermYear.js";

export type FeeComplianceIssue = {
  studentId: number;
  admissionNumber: string;
  fullName: string;
  className: string | null;
  term: string;
  reason: "missing_status" | "missing_assignment" | "zero_amount";
};

const NOTIFY_TITLE = "Fee compliance: students need a positive assignment";

let complianceNotifyTimer: ReturnType<typeof setTimeout> | null = null;

/** Debounce many rapid student creates / assigns into one check. */
export function scheduleFeeComplianceCheckAndNotify(): void {
  if (complianceNotifyTimer) clearTimeout(complianceNotifyTimer);
  complianceNotifyTimer = setTimeout(() => {
    complianceNotifyTimer = null;
    void runFeeComplianceCheckAndNotify().catch((err) => console.error(err));
  }, 2500);
}

export async function getCurrentTermFromSettings(): Promise<string> {
  const row = await SchoolSetting.findByPk("current_term");
  return normalizeOfficialTerm(row?.settingValue ?? null);
}

export async function listNonCompliantStudentsForTerm(
  term: string,
  academicYear: string,
): Promise<FeeComplianceIssue[]> {
  const students = await Student.findAll({
    attributes: [
      "id",
      "admissionNumber",
      "firstName",
      "middleName",
      "lastName",
      "studentStatusId",
    ],
    include: [{ model: ClassRoom, as: "classRoom", required: false, attributes: ["name"] }],
  });
  const assignments = await StudentFeeAssignment.findAll({
    where: { term, academicYear },
    attributes: ["studentId", "amountDueUgx"],
  });
  const byStudent = new Map<number, number>();
  for (const a of assignments) {
    byStudent.set(a.studentId, Number(a.amountDueUgx) || 0);
  }

  const issues: FeeComplianceIssue[] = [];
  for (const s of students) {
    const classRoom = s.get("classRoom") as ClassRoom | null | undefined;
    const fullName = [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
    if (s.studentStatusId == null) {
      issues.push({
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        fullName,
        className: classRoom?.name ?? null,
        term,
        reason: "missing_status",
      });
      continue;
    }
    const amt = byStudent.get(s.id);
    if (amt === undefined) {
      issues.push({
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        fullName,
        className: classRoom?.name ?? null,
        term,
        reason: "missing_assignment",
      });
    } else if (amt <= 0) {
      issues.push({
        studentId: s.id,
        admissionNumber: s.admissionNumber,
        fullName,
        className: classRoom?.name ?? null,
        term,
        reason: "zero_amount",
      });
    }
  }
  return issues;
}

export function formatComplianceNotificationBody(issues: FeeComplianceIssue[], term: string): string {
  const header = `${issues.length} student(s) need a positive fee assignment for ${term} (school setting: current term).\n\n`;
  const lines = issues.slice(0, 250).map((i) => {
    const flag =
      i.reason === "missing_status"
        ? "no student status"
        : i.reason === "missing_assignment"
          ? "no assignment row"
          : "UGX 0 assigned";
    return `${i.admissionNumber}\t${i.fullName}\t${i.className ?? "—"}\t${flag}`;
  });
  const more = issues.length > 250 ? `\n… and ${issues.length - 250} more.` : "";
  return (
    header +
    "Admission #\tName\tClass\tIssue\n" +
    lines.join("\n") +
    more +
    "\n\nAssign fees under Finance → Assign Student Fees."
  );
}

export async function notifyAdminsFeeComplianceIfNeeded(
  term: string,
  issues: FeeComplianceIssue[],
): Promise<void> {
  if (issues.length === 0) return;

  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await UserNotification.findOne({
    where: {
      title: NOTIFY_TITLE,
      createdAt: { [Op.gte]: hourAgo },
    },
    order: [["createdAt", "DESC"]],
  });
  if (recent) return;

  const admins = await User.findAll({
    attributes: ["id"],
    where: { role: { [Op.in]: ["admin", "super_admin"] } },
  });
  if (admins.length === 0) return;

  const body = formatComplianceNotificationBody(issues, term);
  await UserNotification.bulkCreate(
    admins.map((admin) => ({
      userId: admin.id,
      title: NOTIFY_TITLE,
      body,
    })),
  );
}

export async function runFeeComplianceCheckAndNotify(): Promise<{
  term: string;
  count: number;
}> {
  const { term, academicYear } = await loadOfficialSchoolTermYear();
  const issues = await listNonCompliantStudentsForTerm(term, academicYear);
  await notifyAdminsFeeComplianceIfNeeded(term, issues);
  return { term, count: issues.length };
}
