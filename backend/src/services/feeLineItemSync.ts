import type { Transaction } from "sequelize";
import { Op } from "sequelize";
import {
  Student,
  StudentFeeAssignment,
  StudentFeeLineItem,
} from "../models/index.js";
import { loadOfficialSchoolTermYear } from "../lib/officialSchoolTermYear.js";
import { scheduleFeeComplianceCheckAndNotify } from "./feeAssignmentCompliance.js";

export async function sumLineItemsForStudent(
  studentId: number,
  term: string,
  academicYear: string,
  transaction?: Transaction,
): Promise<number> {
  const rows = await StudentFeeLineItem.findAll({
    where: { studentId, term, academicYear },
    attributes: ["amountUgx"],
    transaction,
  });
  return rows.reduce((sum, row) => sum + Number(row.amountUgx || 0), 0);
}

/** Refresh cached assignment total from line items (creates assignment if missing). */
export async function syncAssignmentRollupFromLineItems(
  studentId: number,
  term: string,
  academicYear: string,
  transaction?: Transaction,
): Promise<StudentFeeAssignment> {
  const total = await sumLineItemsForStudent(studentId, term, academicYear, transaction);
  const [assignment] = await StudentFeeAssignment.findOrCreate({
    where: { studentId, term, academicYear },
    defaults: {
      studentId,
      term,
      academicYear,
      amountDueUgx: total,
      notes: null,
    },
    transaction,
  });
  if (Number(assignment.amountDueUgx) !== total) {
    await assignment.update({ amountDueUgx: total }, { transaction });
  }
  return assignment;
}

export async function countStudentsMissingStatus(): Promise<number> {
  return Student.count({
    where: { studentStatusId: { [Op.is]: null } },
  });
}

export async function refreshRollupsForTerm(
  term?: string,
  academicYear?: string,
): Promise<void> {
  const official = await loadOfficialSchoolTermYear();
  const t = term ?? official.term;
  const y = academicYear ?? official.academicYear;
  const studentIds = await StudentFeeLineItem.findAll({
    where: { term: t, academicYear: y },
    attributes: ["studentId"],
    group: ["student_id"],
  });
  for (const row of studentIds) {
    await syncAssignmentRollupFromLineItems(row.studentId, t, y);
  }
  scheduleFeeComplianceCheckAndNotify();
}
