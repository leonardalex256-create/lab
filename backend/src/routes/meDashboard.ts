import { Router } from "express";
import { Op, QueryTypes, fn, col, where } from "sequelize";
import type { Config } from "../config.js";
import { ensureDashboardSchema } from "../db/ensureDashboardSchema.js";
import { safeLocaleDate } from "../formatting/localeDate.js";
import { schoolExpenseToApiRow } from "../formatting/schoolExpenseRow.js";
import {
  AttendanceRecord,
  ClassRoom,
  DashboardChartPoint,
  DashboardKpi,
  Enquiry,
  NoticeBoardEntry,
  SchoolEvent,
  SchoolExpense,
  SocialPlatformStat,
  StaffMember,
  Student,
  UserMessage,
  User,
} from "../models/index.js";

function formatFollowerSub(n: number): string {
  if (n >= 1000) {
    const k = n / 1000;
    const s = k % 1 === 0 ? k.toFixed(0) : k.toFixed(1);
    return `${s}k`;
  }
  return String(n);
}

function todayDateOnly(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthRange(ym: string): { start: string; end: string } {
  const [ys, ms] = ym.split("-");
  const y = Number(ys);
  const mo = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || mo < 1 || mo > 12) {
    return { start: "2026-04-01", end: "2026-04-30" };
  }
  const last = new Date(y, mo, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${y}-${pad(mo)}-01`,
    end: `${y}-${pad(mo)}-${pad(last)}`,
  };
}

const SOCIAL_TILES: Record<string, { className: string }> = {
  facebook: {
    className:
      "bg-gradient-to-br from-[#b9d9eb] to-[#8bb8d4] text-[#2d3436] shadow-[4px_4px_10px_rgba(150,180,200,0.45),-3px_-3px_8px_rgba(255,255,255,0.9)]",
  },
  x: {
    className:
      "bg-gradient-to-br from-[#dfe5e8] to-[#b8c2c8] text-[#2d3436] shadow-[4px_4px_10px_rgba(160,170,175,0.4),-3px_-3px_8px_rgba(255,255,255,0.9)]",
  },
  google: {
    className:
      "bg-gradient-to-br from-[#f7d1cd] to-[#e8b5b0] text-[#2d3436] shadow-[4px_4px_10px_rgba(200,160,155,0.4),-3px_-3px_8px_rgba(255,255,255,0.9)]",
  },
  linkedin: {
    className:
      "bg-gradient-to-br from-[#c5dff0] to-[#9cc9e0] text-[#2d3436] shadow-[4px_4px_10px_rgba(140,170,190,0.4),-3px_-3px_8px_rgba(255,255,255,0.9)]",
  },
};

const DEFAULT_CHART: [number, number][] = [
  [0, 55],
  [30, 40],
  [60, 48],
  [90, 25],
  [120, 35],
  [150, 20],
  [180, 30],
  [200, 15],
];

export function createMeDashboardRouter(config: Config) {
  const r = Router();

  r.get("/dashboard", async (req, res) => {
    const termRaw =
      typeof req.query.term === "string" ? req.query.term.trim() : "";
    const viewingTerm =
      termRaw === "Term 1" || termRaw === "Term 2" || termRaw === "Term 3" ? termRaw : null;
    const academicYearRaw =
      typeof req.query.academicYear === "string" ? req.query.academicYear.trim() : "";
    const viewingAcademicYear = /^\d{4}$/.test(academicYearRaw) ? academicYearRaw : null;

    let ymRaw =
      typeof req.query.calendarMonth === "string" ? req.query.calendarMonth.trim() : "";
    if (!/^\d{4}-\d{2}$/.test(ymRaw) && viewingAcademicYear) {
      ymRaw = `${viewingAcademicYear}-04`;
    }
    const calendarMonth = /^\d{4}-\d{2}$/.test(ymRaw) ? ymRaw : "2026-04";
    const { start, end } = monthRange(calendarMonth);
    const [y, m] = calendarMonth.split("-").map(Number);
    const monthLabel = new Date(y, m - 1, 1).toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    try {
      const today = todayDateOnly();
      const sequelize = Student.sequelize!;

      const userId = req.userId ?? null;
      const userRow = userId ? await User.findByPk(userId, { attributes: ["fullName", "email", "role"] }) : null;
      const userName = userRow?.fullName ?? userRow?.email ?? "User";
      const userRole = (userRow?.role ?? "").toLowerCase();

      const isParent = userRole === "parent" && Boolean(userRow?.email);
      const loadParentChildren = () =>
        isParent
          ? Student.findAll({
              where: { parentEmail: userRow!.email },
              include: [{ model: ClassRoom, as: "classRoom", required: false }],
              order: [["id", "ASC"]],
              limit: 10,
            })
          : Promise.resolve([] as Student[]);

      const loadAggregate = () =>
        Promise.all([
          Student.count(),
          StaffMember.count({
            where: {
              [Op.or]: [
                where(fn("LOWER", col("staff_role")), "teaching"),
                where(fn("LOWER", col("staff_role")), "teacher"),
              ],
            },
          }),
          StaffMember.count({ where: { staffRole: "librarian" } }),
          StaffMember.count({ where: { staffRole: "accountant" } }),
          Enquiry.count(),
          UserMessage.count(),
          AttendanceRecord.count({
            where: { recordDate: today, present: true },
          }),
          SchoolExpense.findAll({
            order: [["expenseDate", "DESC"]],
            limit: 25,
          }),
          NoticeBoardEntry.findAll({
            order: [["publishedAt", "DESC"]],
            limit: 12,
          }),
          SchoolEvent.findAll({
            where: { eventDate: { [Op.between]: [start, end] } },
            order: [["eventDate", "ASC"]],
          }),
          DashboardChartPoint.findAll({ order: [["sortOrder", "ASC"]] }),
          SocialPlatformStat.findAll({ order: [["sortOrder", "ASC"]] }),
          DashboardKpi.findAll(),
          Student.findAll({
            include: [{ model: ClassRoom, as: "classRoom", required: false }],
            // Physical column — camelCase `createdAt` can become invalid SQL (`Student.createdAt`) with underscored models.
            order: [["created_at", "DESC"]],
            limit: 4,
          }),
          ClassRoom.count(),
          loadParentChildren(),
        ]);

      let batch: Awaited<ReturnType<typeof loadAggregate>>;
      try {
        batch = await loadAggregate();
      } catch (firstErr) {
        console.error(
          "[dashboard] aggregate query failed; running ensureDashboardSchema and retrying…",
          firstErr,
        );
        await ensureDashboardSchema(sequelize);
        batch = await loadAggregate();
      }

      const [
        totalStudents,
        totalTeachers,
        totalLibrarians,
        totalAccountants,
        totalEnquiries,
        allMessages,
        presentToday,
        expenseRows,
        noticeRows,
        eventRows,
        chartRows,
        socialRows,
        kpiRows,
        learnerRows,
        activeClassRooms,
        parentChildrenRows,
      ] = batch;

      const parentRows = (await sequelize.query(
        `SELECT COUNT(DISTINCT parent_email) AS c FROM students WHERE parent_email IS NOT NULL AND parent_email <> ''`,
        { type: QueryTypes.SELECT },
      )) as [{ c: number | string }];
      const totalParents = Number(parentRows[0]?.c ?? 0) || 0;

      const kpiMap = Object.fromEntries(
        kpiRows.map((row) => [row.kpiKey, row.valueText]),
      );

      const chartPoints: [number, number][] =
        chartRows.length > 0
          ? chartRows.map((p) => [p.xPos, p.yPos])
          : DEFAULT_CHART;

      const highlightDays = new Set<number>();
      for (const ev of eventRows) {
        const d = new Date(`${ev.eventDate}T12:00:00`);
        if (!Number.isNaN(d.getTime())) highlightDays.add(d.getDate());
      }

      const calendarEvents = eventRows.map((ev) => {
        const d = new Date(`${ev.eventDate}T12:00:00`);
        const day = Number.isNaN(d.getTime()) ? 0 : d.getDate();
        return {
          date: safeLocaleDate(ev.eventDate),
          day,
          title: ev.title,
        };
      });

      const learners = learnerRows.map((s, i) => {
        const cr = s.get("classRoom") as ClassRoom | null | undefined;
        const created =
          s.createdAt ??
          (s.get("created_at") as Date | string | undefined) ??
          (s.getDataValue("created_at") as Date | string | undefined);
        return {
          title: `Learner profile ${String(i + 1).padStart(2, "0")}`,
          name: `${s.firstName} ${s.lastName}`.trim(),
          gender: s.gender ?? "—",
          admissionId: s.admissionNumber,
          admissionDate: safeLocaleDate(created),
          className: cr?.name ?? "—",
          section: s.sectionName ?? "—",
        };
      });

      const notices = noticeRows.map((n) => ({
        date: safeLocaleDate(
          n.publishedAt ??
            (n.get("published_at") as Date | string | undefined),
        ),
        author: n.authorLabel,
        text: n.body,
      }));

      const expenses = expenseRows.map((row) => schoolExpenseToApiRow(row));

      const social = socialRows.map((s) => {
        const tile = SOCIAL_TILES[s.platformKey] ?? SOCIAL_TILES.facebook;
        return {
          platformKey: s.platformKey,
          label: s.displayLabel,
          sub: formatFollowerSub(s.followerCount),
          className: tile.className,
        };
      });

      return res.json({
        meta: {
          term: viewingTerm,
          academicYear: viewingAcademicYear,
          calendarMonth,
          /** KPI row values are not filtered by term/year in this release. */
          kpisAreGlobal: true,
        },
        userName,
        stats: {
          totalStudents,
          totalTeachers,
          totalParents,
          totalLibrarians,
          totalAccountants,
          totalEnquiries,
          allMessages,
          presentToday,
          // role scoped placeholders (filled as backend adds true calculations)
          ...(userRole === "registrar"
            ? { newAdmissionsThisTerm: 0, linkedParents: totalParents, incompleteProfiles: 0 }
            : {}),
          ...(userRole === "staff" ? { activeNotices: noticeRows.length, unreadMessages: 0 } : {}),
        },
        kpis: {
          dueFees: kpiMap.due_fees ?? "—",
          upcomingExams: kpiMap.upcoming_exams ?? "—",
          resultsPublished: kpiMap.results_published ?? "—",
          termExpenses: kpiMap.term_expenses ?? "—",
        },
        snapshot: {
          activeStudents: totalStudents,
          classRooms: activeClassRooms,
        },
        calendar: {
          yearMonth: calendarMonth,
          monthLabel,
          highlightDays: [...highlightDays].sort((a, b) => a - b),
          events: calendarEvents,
        },
        chartPoints,
        social,
        learners,
        notices,
        expenses,
        availableExamTypes: ["BOT", "MID", "EOT"],
        academicAlerts: [],
        registrarActions: [],
        ...(isParent
          ? {
              linkedChildren: parentChildrenRows.map((s) => {
                const cr = s.get("classRoom") as ClassRoom | null | undefined;
                return {
                  id: s.id,
                  name: `${s.firstName} ${s.lastName}`.trim(),
                  className: cr?.name ?? "—",
                  admissionNumber: s.admissionNumber,
                };
              }),
            }
          : {}),
      });
    } catch (err) {
      console.error(err);
      const sqlMsg = (err as { parent?: { sqlMessage?: string } })?.parent
        ?.sqlMessage;
      const detail =
        config.NODE_ENV === "development"
          ? (sqlMsg ?? (err as Error)?.message ?? String(err)).slice(0, 600)
          : undefined;
      return res.status(503).json({
        error: "Database unavailable",
        ...(detail ? { detail } : {}),
      });
    }
  });

  return r;
}
