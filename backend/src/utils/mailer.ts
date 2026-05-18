/**
 * Centralised mailer utility (Section C3).
 * Provider selection: MAILER_PROVIDER=resend | nodemailer (default).
 * In development with no SMTP/Resend config: prints Ethereal preview URL.
 */
import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "../templates/emails");

// ─── Template engine (simple {{variable}} replacement) ────────────────────
function compileTemplate(templateName: string, variables: Record<string, string>): string {
  const filePath = path.join(TEMPLATES_DIR, `${templateName}.html`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Email template not found: ${templateName}`);
  }
  let html = fs.readFileSync(filePath, "utf-8");
  for (const [key, value] of Object.entries(variables)) {
    html = html.replaceAll(`{{${key}}}`, value);
  }
  return html;
}

// ─── Transporter factory ──────────────────────────────────────────────────
let _transporter: nodemailer.Transporter | null = null;
let _etherealUser: string | null = null;
let _etherealPass: string | null = null;

async function getTransporter(): Promise<nodemailer.Transporter> {
  if (_transporter) return _transporter;

  const provider = process.env.MAILER_PROVIDER ?? "nodemailer";

  if (provider === "resend" && process.env.RESEND_API_KEY) {
    // Resend via their SMTP bridge
    _transporter = nodemailer.createTransport({
      host: "smtp.resend.com",
      port: 465,
      secure: true,
      auth: {
        user: "resend",
        pass: process.env.RESEND_API_KEY,
      },
    });
    return _transporter;
  }

  if (process.env.SMTP_HOST) {
    _transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT ?? 587) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" }
        : undefined,
    });
    return _transporter;
  }

  // Development fallback: Ethereal test account
  const testAccount = await nodemailer.createTestAccount();
  _etherealUser = testAccount.user;
  _etherealPass = testAccount.pass;
  _transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  console.info("[mailer] Using Ethereal test account:", testAccount.user);
  return _transporter;
}

// ─── Public send function ─────────────────────────────────────────────────
export interface SendMailOptions {
  to: string;
  subject: string;
  templateName: string;
  variables: Record<string, string>;
}

export async function sendMail(opts: SendMailOptions): Promise<void> {
  const { to, subject, templateName, variables } = opts;
  const transporter = await getTransporter();
  const html = compileTemplate(templateName, variables);

  const fromName = process.env.SMTP_FROM_NAME ?? process.env.RESEND_FROM?.split("<")[0]?.trim() ?? "School SMS";
  const fromEmail =
    process.env.SMTP_FROM_EMAIL ??
    process.env.RESEND_FROM?.match(/<([^>]+)>/)?.[1] ??
    "noreply@school.edu";

  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html,
  });

  console.info(`[mailer] Sent "${subject}" to ${to} — messageId: ${info.messageId}`);

  // In development with Ethereal, log preview URL
  if (_etherealUser) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.info(`[mailer] ✉  Preview URL: ${previewUrl}`);
    }
  }
}
