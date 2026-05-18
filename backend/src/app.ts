import express, { Router } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import type { Config } from "./config.js";
import { requireAuth } from "./middleware/requireAuth.js";
import { healthRouter } from "./routes/health.js";
import { createAuthRouter } from "./routes/auth.js";
import { createPasswordResetRouter } from "./routes/passwordReset.js";
import { createMeAccountRouter } from "./routes/meAccount.js";
import { createMeInboxRouter } from "./routes/meInbox.js";
import { createMeDashboardRouter } from "./routes/meDashboard.js";
import { createMeExpensesRouter } from "./routes/meExpenses.js";
import { createMeGeoRouter } from "./routes/meGeo.js";
import { createMeStudentsRouter } from "./routes/meStudents.js";
import { createMeFinanceDashboardRouter } from "./routes/meFinanceDashboard.js";
import { createMeFinanceLedgerRouter } from "./routes/meFinanceLedger.js";
import { createMeFinancePaymentsRouter } from "./routes/meFinancePayments.js";
import { createMeFinanceHistoricalRouter } from "./routes/meFinanceHistorical.js";
import { createMeFinanceReportsRouter } from "./routes/meFinanceReports.js";
import { createMeFinanceStatementsRouter } from "./routes/meFinanceStatements.js";
import { createMeAcademicsRouter } from "./routes/meAcademics.js";
import { createMeExamsRouter } from "./routes/meExams.js";
import { createMeCommunicationNoticesRouter } from "./routes/meCommunicationNotices.js";
import { createMeFinanceBurseryRouter } from "./routes/meFinanceBursery.js";
import { createMeRecordsSearchRouter } from "./routes/meRecordsSearch.js";
import { createMeSettingsRouter } from "./routes/meSettings.js";
import { createMeStaffRouter } from "./routes/meStaff.js";
import { createMeParentsRouter } from "./routes/meParents.js";
import { createMeAttendanceRouter } from "./routes/meAttendance.js";
import { createMeResultsRouter } from "./routes/meResults.js";
import { createMeAuditLogRouter } from "./routes/meAuditLog.js";
import { createMeUploadRouter } from "./routes/meUpload.js";
import { createForgotPasswordRouter } from "./routes/forgotPassword.js";

export function buildApp(config: Config) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json());

  app.use((req, res, next) => {
    const startMs = Date.now();
    res.on("finish", () => {
      if (!req.path.startsWith("/api/")) return;
      // #region agent log
      fetch("http://127.0.0.1:7892/ingest/16abbfe8-e461-4655-b535-5e0791d093a7", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6885fa" },
        body: JSON.stringify({
          sessionId: "6885fa",
          runId: "initial",
          hypothesisId: "H1",
          location: "backend/src/app.ts:29",
          message: "api_request_finished",
          data: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Date.now() - startMs,
            userId: typeof req.userId === "number" ? req.userId : null,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    });
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: config.NODE_ENV === "production",
    }),
  );

  const origins = config.CORS_ORIGIN.split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  /** In development, allow any http(s) localhost / 127.0.0.1 port so Vite is fine on 5174, 5175, … */
  const corsOrigin =
    config.NODE_ENV === "development"
      ? (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
          if (!origin) {
            callback(null, true);
            return;
          }
          if (origins.includes(origin)) {
            callback(null, true);
            return;
          }
          if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
            callback(null, true);
            return;
          }
          callback(null, false);
        }
      : origins.length
        ? origins
        : false;

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );

  app.use(
    rateLimit({
      windowMs: 60_000,
      max: config.NODE_ENV === "production" ? 200 : 2000,
    }),
  );

  app.use("/api", healthRouter);
  app.use("/api/auth", createAuthRouter(config));
  app.use("/api/auth", createPasswordResetRouter(config));
  app.use("/api/auth", createForgotPasswordRouter(config));

  const meRouter = Router();
  meRouter.use(createMeInboxRouter());
  meRouter.use(createMeExpensesRouter());
  meRouter.use(createMeGeoRouter());
  meRouter.use(createMeStudentsRouter());
  meRouter.use(createMeStaffRouter());
  meRouter.use(createMeParentsRouter());
  meRouter.use(createMeAttendanceRouter());
  meRouter.use(createMeResultsRouter());
  meRouter.use(createMeUploadRouter());
  meRouter.use("/settings", createMeAuditLogRouter());
  meRouter.use(createMeFinanceDashboardRouter());
  meRouter.use(createMeFinanceLedgerRouter());
  meRouter.use(createMeFinancePaymentsRouter());
  meRouter.use(createMeFinanceHistoricalRouter());
  meRouter.use(createMeFinanceReportsRouter());
  meRouter.use(createMeFinanceStatementsRouter());
  meRouter.use(createMeFinanceBurseryRouter());
  meRouter.use(createMeRecordsSearchRouter());
  meRouter.use(createMeAcademicsRouter());
  meRouter.use(createMeExamsRouter());
  meRouter.use("/communication/notices", createMeCommunicationNoticesRouter());
  meRouter.use("/settings", createMeSettingsRouter());
  meRouter.use(createMeDashboardRouter(config));
  meRouter.use(createMeAccountRouter(config));
  app.use("/api/me", requireAuth(config), meRouter);

  return app;
}
