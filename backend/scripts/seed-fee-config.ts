import { loadConfig } from "../src/config.js";
import { setupDatabase } from "../src/models/index.js";
import {
  FeeCategory,
  FeeCategoryStatus,
  FeeRule,
  Student,
  StudentStatus,
} from "../src/models/index.js";
import { generateAndPersistLineItems } from "../src/services/feeRuleEngine.js";
import { loadOfficialSchoolTermYear } from "../src/lib/officialSchoolTermYear.js";

async function main() {
  const config = loadConfig();
  setupDatabase(config);
  await StudentStatus.sequelize!.sync({ alter: true });

  const statuses = [
    { name: "Day Scholar", code: "DS", colorHex: "#3b82f6", sortOrder: 1 },
    { name: "Boarder", code: "BD", colorHex: "#8b5cf6", sortOrder: 2 },
    { name: "Special Case", code: "SC", colorHex: "#f59e0b", sortOrder: 3 },
  ];
  const statusRows: StudentStatus[] = [];
  for (const s of statuses) {
    const [row] = await StudentStatus.findOrCreate({
      where: { code: s.code },
      defaults: { ...s, description: null, archivedAt: null },
    });
    statusRows.push(row);
  }

  const categories = [
    { name: "Tuition", code: "TUITION", billingFrequency: "term" as const },
    { name: "Meals", code: "MEALS", billingFrequency: "term" as const },
    { name: "Development", code: "DEV", billingFrequency: "annual" as const },
  ];
  const categoryRows: FeeCategory[] = [];
  for (const c of categories) {
    const [row] = await FeeCategory.findOrCreate({
      where: { code: c.code },
      defaults: {
        ...c,
        isMandatory: true,
        description: null,
        isActive: true,
      },
    });
    categoryRows.push(row);
    for (const st of statusRows) {
      await FeeCategoryStatus.findOrCreate({
        where: { feeCategoryId: row.id, studentStatusId: st.id },
        defaults: { feeCategoryId: row.id, studentStatusId: st.id },
      });
    }
  }

  const ds = statusRows.find((s) => s.code === "DS")!;
  const bd = statusRows.find((s) => s.code === "BD")!;
  const tuition = categoryRows.find((c) => c.code === "TUITION")!;
  const meals = categoryRows.find((c) => c.code === "MEALS")!;

  await FeeRule.findOrCreate({
    where: { name: "Day tuition base", feeCategoryId: tuition.id, studentStatusId: ds.id },
    defaults: {
      name: "Day tuition base",
      feeCategoryId: tuition.id,
      studentStatusId: ds.id,
      baseAmountUgx: 450_000,
      inputMode: "plain",
      plainEnglishText: "Standard day scholar tuition",
      formulaText: null,
      priority: 100,
      isActive: true,
    },
  });

  await FeeRule.findOrCreate({
    where: { name: "Boarder tuition", feeCategoryId: tuition.id, studentStatusId: bd.id },
    defaults: {
      name: "Boarder tuition",
      feeCategoryId: tuition.id,
      studentStatusId: bd.id,
      baseAmountUgx: 800_000,
      inputMode: "formula",
      plainEnglishText: null,
      formulaText: "{baseAmount}",
      priority: 100,
      isActive: true,
    },
  });

  await FeeRule.findOrCreate({
    where: { name: "Boarder meals", feeCategoryId: meals.id, studentStatusId: bd.id },
    defaults: {
      name: "Boarder meals",
      feeCategoryId: meals.id,
      studentStatusId: bd.id,
      baseAmountUgx: 200_000,
      inputMode: "formula",
      plainEnglishText: "10% meals discount",
      formulaText: "IF({baseAmount}>0, ROUND({baseAmount}*0.9, 0), 0)",
      priority: 100,
      isActive: true,
    },
  });

  const { term, academicYear } = await loadOfficialSchoolTermYear();
  const sampleStudents = await Student.findAll({ limit: 5, order: [["id", "ASC"]] });
  for (let i = 0; i < sampleStudents.length; i++) {
    const st = sampleStudents[i]!;
    const status = i % 2 === 0 ? ds : bd;
    if (!st.studentStatusId) {
      await st.update({ studentStatusId: status.id });
    }
    await generateAndPersistLineItems({
      studentId: st.id,
      term,
      academicYear,
    });
  }

  console.log("Fee config seed complete:", {
    statuses: statusRows.length,
    categories: categoryRows.length,
    term,
    academicYear,
  });
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
