import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import {
  fetchClassrooms,
  fetchStudents,
  type ClassRoomOption,
  type StudentApiRow,
  type StudentSortBy,
  type StudentSortDir,
} from "../../../api/students";
import { assignStudentFee } from "../../../api/financeStatements";
import { generateStudentLineItems } from "../../../api/studentFees";
import { fetchFeeStructure, type FeeStructureRow } from "../../../api/financeFeeStructure";
import { formatCurrencyUGX } from "../shared/financeFormat";
import { AuthenticatedStudentPhoto } from "../../students/AuthenticatedStudentPhoto";
import { useTermContext } from "../../../context/TermContext";
import { fetchStudentStatuses, type StudentStatusRow } from "../../../api/studentStatuses";
import { studentFeeStatusLabel } from "../../../utils/studentStatusDisplay";

const PAGE_SIZE = 50;
const FEE_ASSIGN_BY_STUDENT_STATUS = "__assign_by_student_status__";
const CUSTOM_FEE_STATUS = "__custom__";

const tokens = {
  colorPrimary: "var(--color-primary, #0c2340)",
  colorSurface: "var(--color-surface, #fff)",
  colorBorder: "var(--color-border, #e2e8f0)",
  colorMuted: "var(--color-muted, #64748b)",
  colorDanger: "var(--color-danger, #991b1b)",
  colorSuccess: "var(--color-success, #065f46)",
  colorWarning: "var(--color-warning, #92400e)",
  radiusMd: "var(--radius-md, 12px)",
  radiusLg: "var(--radius-lg, 14px)",
  radiusXl: "var(--radius-xl, 28px)",
  shadowCard: "var(--shadow-card, 0 10px 25px -5px rgba(0,0,0,0.05))",
  accentBlue: "var(--color-accent-blue, #2563eb)",
  accentBlueSoft: "var(--color-accent-blue-soft, rgba(37,99,235,0.08))",
  slate50: "var(--color-slate-50, #f8fafc)",
  slate100: "var(--color-slate-100, #f1f5f9)",
  slate200: "var(--color-slate-200, #cbd5e1)",
  slate700: "var(--color-slate-700, #334155)",
  slate900: "var(--color-slate-900, #0f172a)",
  amberSoft: "var(--color-amber-soft, #fef3c7)",
  redSoft: "var(--color-red-soft, #fef2f2)",
  successSoft: "var(--color-success-soft, #ecfdf5)",
};

const styles = {
  root: { maxWidth: 1200, margin: "0 auto" } satisfies CSSProperties,
  card: {
    position: "relative",
    background: tokens.colorSurface,
    borderRadius: tokens.radiusXl,
    padding: "32px 40px 40px",
    border: `1px solid ${tokens.colorBorder}`,
    boxShadow: tokens.shadowCard,
  } satisfies CSSProperties,
  headerWrap: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  backBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    padding: "8px 14px",
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    background: tokens.colorSurface,
    color: tokens.slate700,
    fontWeight: 700,
    fontSize: "0.82rem",
    cursor: "pointer",
  } satisfies CSSProperties,
  title: {
    color: tokens.colorPrimary,
    margin: 0,
    fontWeight: 800,
    fontSize: "1.5rem",
    letterSpacing: "-0.02em",
  } satisfies CSSProperties,
  subtitle: {
    color: tokens.colorMuted,
    fontSize: "0.9rem",
    marginTop: 6,
    maxWidth: 620,
  } satisfies CSSProperties,
  readOnlyBanner: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    background: tokens.amberSoft,
    border: `1px solid ${tokens.colorWarning}`,
    borderRadius: tokens.radiusMd,
    padding: "9px 12px",
    color: tokens.colorWarning,
    fontSize: "0.82rem",
    fontWeight: 700,
  } satisfies CSSProperties,
  selectedBadge: {
    padding: "10px 14px",
    borderRadius: tokens.radiusMd,
    background: tokens.slate100,
    border: `1px solid ${tokens.slate200}`,
    fontSize: "0.8rem",
    fontWeight: 700,
    color: tokens.slate900,
    transition: "background 0.2s, border-color 0.2s, color 0.2s",
  } satisfies CSSProperties,
  selectedBadgeActive: {
    background: tokens.accentBlueSoft,
    border: `1px solid ${tokens.accentBlue}`,
    color: tokens.accentBlue,
  } satisfies CSSProperties,
  sectionTitle: { margin: 0, color: tokens.slate900, fontWeight: 800, fontSize: "1rem" } satisfies CSSProperties,
  sectionSub: { margin: "6px 0 14px", color: tokens.colorMuted, fontSize: "0.84rem" } satisfies CSSProperties,
  filterRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 14,
    alignItems: "flex-end",
  } satisfies CSSProperties,
  fieldWrap: { minWidth: 170, flex: "1 1 180px" } satisfies CSSProperties,
  fieldLabel: {
    fontWeight: 700,
    color: tokens.slate700,
    fontSize: "0.75rem",
    display: "block",
    marginBottom: 6,
  } satisfies CSSProperties,
  fieldInput: {
    height: 48,
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    padding: "0 12px",
    fontSize: "0.95rem",
    width: "100%",
    boxSizing: "border-box",
    background: tokens.colorSurface,
    color: tokens.slate900,
    fontFamily: "inherit",
  } satisfies CSSProperties,
  termBadge: {
    height: 48,
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    padding: "0 12px",
    fontSize: "0.9rem",
    width: "100%",
    boxSizing: "border-box",
    background: tokens.slate100,
    color: tokens.slate700,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
  } satisfies CSSProperties,
  resetFiltersBtn: {
    border: "none",
    background: "transparent",
    color: tokens.accentBlue,
    fontSize: "0.8rem",
    fontWeight: 700,
    textDecoration: "underline",
    cursor: "pointer",
    padding: "4px 2px",
  } satisfies CSSProperties,
  chipRow: { display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 12 } satisfies CSSProperties,
  tableWrap: {
    borderRadius: tokens.radiusLg,
    border: `1px solid ${tokens.colorBorder}`,
    overflow: "hidden",
  } satisfies CSSProperties,
  tableToolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    background: tokens.slate50,
    borderBottom: `1px solid ${tokens.colorBorder}`,
    fontSize: "0.78rem",
    color: tokens.colorMuted,
    fontWeight: 600,
    gap: 12,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  tableToolbarActions: { display: "flex", alignItems: "center", gap: 12 } satisfies CSSProperties,
  selectAllLabel: { display: "flex", alignItems: "center", gap: 6, cursor: "pointer" } satisfies CSSProperties,
  clearBtn: {
    border: "none",
    background: "transparent",
    color: tokens.accentBlue,
    fontWeight: 700,
    cursor: "pointer",
    fontSize: "0.78rem",
  } satisfies CSSProperties,
  tableScroll: { overflowX: "auto", maxHeight: "min(55vh, 520px)", overflowY: "auto" } satisfies CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" } satisfies CSSProperties,
  th: {
    padding: "10px 8px",
    textAlign: "left",
    borderBottom: `1px solid ${tokens.colorBorder}`,
    fontSize: "0.67rem",
    fontWeight: 800,
    color: tokens.colorMuted,
    letterSpacing: "0.04em",
    background: tokens.slate100,
    position: "sticky",
    top: 0,
    zIndex: 1,
  } satisfies CSSProperties,
  thCenter: { textAlign: "center", padding: "10px 6px" } satisfies CSSProperties,
  emptyState: {
    padding: 24,
    textAlign: "center",
    color: tokens.colorMuted,
    fontWeight: 600,
  } satisfies CSSProperties,
  sentinel: { height: 1 } satisfies CSSProperties,
  loadMoreWrap: { padding: 12, textAlign: "center", borderTop: `1px solid ${tokens.colorBorder}` } satisfies CSSProperties,
  loadMoreBtn: {
    padding: "10px 20px",
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    background: tokens.colorSurface,
    fontWeight: 700,
    color: tokens.colorPrimary,
    cursor: "pointer",
  } satisfies CSSProperties,
  divider: { borderTop: `1px solid ${tokens.colorBorder}`, margin: "24px 0" } satisfies CSSProperties,
  bannerContainer: { marginBottom: 12 } satisfies CSSProperties,
  bannerBase: {
    borderRadius: tokens.radiusMd,
    padding: "12px 16px",
    marginBottom: 12,
    fontSize: "0.86rem",
  } satisfies CSSProperties,
  bannerValidation: { background: tokens.amberSoft, border: `1px solid ${tokens.colorWarning}`, color: tokens.colorWarning } satisfies CSSProperties,
  bannerPartial: { background: "#ffedd5", border: `1px solid #fdba74`, color: "#9a3412" } satisfies CSSProperties,
  bannerFatal: { background: tokens.redSoft, border: `1px solid ${tokens.colorDanger}`, color: tokens.colorDanger } satisfies CSSProperties,
  bannerSuccess: { background: tokens.successSoft, border: `1px solid ${tokens.colorSuccess}`, color: tokens.colorSuccess } satisfies CSSProperties,
  detailsList: { marginTop: 8, maxHeight: 140, overflowY: "auto" } satisfies CSSProperties,
  detailsSummary: { cursor: "pointer", fontWeight: 800 } satisfies CSSProperties,
  confirmOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: 16,
  } satisfies CSSProperties,
  confirmDialog: {
    width: "min(640px, 100%)",
    background: tokens.colorSurface,
    borderRadius: tokens.radiusLg,
    border: `1px solid ${tokens.colorBorder}`,
    boxShadow: tokens.shadowCard,
    padding: 16,
  } satisfies CSSProperties,
  confirmText: { whiteSpace: "pre-wrap", color: tokens.slate900, fontSize: "0.9rem", margin: "0 0 14px" } satisfies CSSProperties,
  confirmActions: { display: "flex", justifyContent: "flex-end", gap: 8 } satisfies CSSProperties,
  confirmBtnBase: {
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    padding: "8px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
  } satisfies CSSProperties,
  confirmBtnCancel: { background: tokens.colorSurface, color: tokens.slate700 } satisfies CSSProperties,
  confirmBtnConfirm: { background: tokens.colorPrimary, color: "#fff", border: `1px solid ${tokens.colorPrimary}` } satisfies CSSProperties,
  spinnerInline: { width: 16, height: 16, display: "inline-block" } satisfies CSSProperties,
  spinnerWrap: { display: "inline-flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  previewLine: { marginTop: 6, color: tokens.colorMuted, fontSize: "0.8rem", fontWeight: 600 } satisfies CSSProperties,
  notesCounter: { marginTop: 4, textAlign: "right", fontSize: "0.72rem", color: tokens.colorMuted } satisfies CSSProperties,
  monogramAvatar: {
    width: 44,
    height: 44,
    borderRadius: "50%",
    background: tokens.slate100,
    color: tokens.colorPrimary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 800,
    fontSize: "0.78rem",
    border: `1px solid ${tokens.colorBorder}`,
  } satisfies CSSProperties,
  photoBox: { width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0 } satisfies CSSProperties,
  rowBase: { borderBottom: `1px solid ${tokens.slate100}` } satisfies CSSProperties,
  rowSelected: { background: tokens.accentBlueSoft, borderLeft: `3px solid ${tokens.accentBlue}` } satisfies CSSProperties,
  rowOdd: { background: tokens.slate50 } satisfies CSSProperties,
  td: { padding: "10px 8px", color: tokens.slate700, verticalAlign: "middle" } satisfies CSSProperties,
  tdStrong: { padding: "10px 8px", color: tokens.slate900, fontWeight: 700, verticalAlign: "middle" } satisfies CSSProperties,
  checkboxCell: { padding: 0, verticalAlign: "middle", width: 52 } satisfies CSSProperties,
  checkboxLabel: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    width: "100%",
    cursor: "pointer",
    boxSizing: "border-box",
    padding: "6px 8px",
  } satisfies CSSProperties,
  statusTag: {
    marginLeft: 8,
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: "0.7rem",
    fontWeight: 800,
    background: tokens.amberSoft,
    color: tokens.colorWarning,
  } satisfies CSSProperties,
  previewTableWrap: {
    border: `1px solid ${tokens.slate200}`,
    borderRadius: tokens.radiusMd,
    background: tokens.slate50,
    padding: 12,
    marginBottom: 14,
  } satisfies CSSProperties,
  previewTitle: { margin: "0 0 8px", fontSize: "0.8rem", fontWeight: 800, color: tokens.slate900 } satisfies CSSProperties,
  previewTable: { width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" } satisfies CSSProperties,
  previewCellMain: { padding: "6px 0", fontWeight: 700, color: tokens.slate900 } satisfies CSSProperties,
  previewCellCount: { padding: "6px 0", color: tokens.slate700, textAlign: "right" } satisfies CSSProperties,
  previewCellAmount: { padding: "6px 0", color: tokens.slate900, textAlign: "right", fontWeight: 800 } satisfies CSSProperties,
  previewCellWarn: { padding: "6px 0 6px 10px", color: tokens.colorWarning, fontWeight: 700, minWidth: 240 } satisfies CSSProperties,
  feeSectionGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 } satisfies CSSProperties,
  textarea: {
    minHeight: 48,
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    padding: "10px 14px",
    fontSize: "0.95rem",
    width: "100%",
    boxSizing: "border-box",
    resize: "vertical",
    fontFamily: "inherit",
    color: tokens.slate900,
    background: tokens.colorSurface,
  } satisfies CSSProperties,
  submitBtn: {
    width: "100%",
    height: 54,
    borderRadius: tokens.radiusLg,
    fontWeight: 700,
    border: "none",
    background: `linear-gradient(135deg, ${tokens.colorPrimary}, #1a3a5c)`,
    color: "#fff",
    fontSize: "0.95rem",
    cursor: "pointer",
  } satisfies CSSProperties,
  submitBtnDisabled: { opacity: 0.5, cursor: "not-allowed" } satisfies CSSProperties,
  bannerMerged: (variantStyle: CSSProperties): CSSProperties => ({
    borderRadius: tokens.radiusMd,
    padding: "12px 16px",
    marginBottom: 12,
    fontSize: "0.86rem",
    ...variantStyle,
  }),
  checkboxInput: { width: 18, height: 18, cursor: "pointer", margin: 0 } satisfies CSSProperties,
  confirmCancelBtn: {
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    padding: "8px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    background: tokens.colorSurface,
    color: tokens.slate700,
  } satisfies CSSProperties,
  confirmAcceptBtn: {
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorPrimary}`,
    padding: "8px 14px",
    fontWeight: 700,
    cursor: "pointer",
    fontFamily: "inherit",
    background: tokens.colorPrimary,
    color: "#fff",
  } satisfies CSSProperties,
  blockMarginBottom: { marginBottom: 16 } satisfies CSSProperties,
  blockMarginTop10: { marginTop: 10 } satisfies CSSProperties,
  amountInputCustom: {
    height: 48,
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    padding: "0 12px",
    fontSize: "0.95rem",
    width: "100%",
    boxSizing: "border-box",
    background: tokens.colorSurface,
    color: tokens.slate900,
    fontFamily: "inherit",
    fontWeight: 700,
  } satisfies CSSProperties,
  amountInputReadonly: {
    height: 48,
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    padding: "0 12px",
    fontSize: "0.95rem",
    width: "100%",
    boxSizing: "border-box",
    background: tokens.slate50,
    color: tokens.slate900,
    fontFamily: "inherit",
    fontWeight: 700,
  } satisfies CSSProperties,
  textStrong: { margin: 0, fontWeight: 800 } satisfies CSSProperties,
  scrollList120: { maxHeight: 120, overflowY: "auto", marginTop: 8 } satisfies CSSProperties,
  listItemStrong: { marginBottom: 4, fontWeight: 600 } satisfies CSSProperties,
  textStrongBottom8: { margin: "0 0 8px", fontWeight: 800 } satisfies CSSProperties,
  listItemTop4: { marginTop: 4, fontWeight: 600 } satisfies CSSProperties,
  submitBtnEnabled: {
    width: "100%",
    height: 54,
    borderRadius: tokens.radiusLg,
    fontWeight: 700,
    border: "none",
    background: `linear-gradient(135deg, ${tokens.colorPrimary}, #1a3a5c)`,
    color: "#fff",
    fontSize: "0.95rem",
    cursor: "pointer",
  } satisfies CSSProperties,
  submitBtnDisabledFull: {
    width: "100%",
    height: 54,
    borderRadius: tokens.radiusLg,
    fontWeight: 700,
    border: "none",
    background: `linear-gradient(135deg, ${tokens.colorPrimary}, #1a3a5c)`,
    color: "#fff",
    fontSize: "0.95rem",
    cursor: "not-allowed",
    opacity: 0.5,
  } satisfies CSSProperties,
  selectedBadgeIdle: {
    padding: "10px 14px",
    borderRadius: tokens.radiusMd,
    background: tokens.slate100,
    border: `1px solid ${tokens.slate200}`,
    fontSize: "0.8rem",
    fontWeight: 700,
    color: tokens.slate900,
    transition: "background 0.2s, border-color 0.2s, color 0.2s",
  } satisfies CSSProperties,
  selectedBadgeOn: {
    padding: "10px 14px",
    borderRadius: tokens.radiusMd,
    background: tokens.accentBlueSoft,
    border: `1px solid ${tokens.accentBlue}`,
    fontSize: "0.8rem",
    fontWeight: 700,
    color: tokens.accentBlue,
    transition: "background 0.2s, border-color 0.2s, color 0.2s",
  } satisfies CSSProperties,
  sectionStepWrap: { marginBottom: 24 } satisfies CSSProperties,
  colSel: { width: 52 } satisfies CSSProperties,
  colPhoto: { width: 56 } satisfies CSSProperties,
  colAdmission: { width: 160 } satisfies CSSProperties,
  colClass: { width: 180 } satisfies CSSProperties,
  colStatus: { width: 220 } satisfies CSSProperties,
  thSel: {
    padding: "10px 6px",
    textAlign: "center",
    borderBottom: `1px solid ${tokens.colorBorder}`,
    fontSize: "0.67rem",
    fontWeight: 800,
    color: tokens.colorMuted,
    letterSpacing: "0.04em",
    background: tokens.slate100,
    position: "sticky",
    top: 0,
    zIndex: 1,
  } satisfies CSSProperties,
  loadMoreBtnDisabled: {
    padding: "10px 20px",
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    background: tokens.colorSurface,
    fontWeight: 700,
    color: tokens.colorPrimary,
    cursor: "not-allowed",
    opacity: 0.5,
  } satisfies CSSProperties,
  loadMoreBtnEnabled: {
    padding: "10px 20px",
    borderRadius: tokens.radiusMd,
    border: `1px solid ${tokens.colorBorder}`,
    background: tokens.colorSurface,
    fontWeight: 700,
    color: tokens.colorPrimary,
    cursor: "pointer",
  } satisfies CSSProperties,
} as const;

type BannerVariant = "validation" | "partial" | "fatal" | "success";
type QuickSelectKey = "all" | "missing" | number;
type AssignError =
  | { kind: "validation"; message: string }
  | { kind: "partial"; successes: number; failures: { student: string; reason: string }[] }
  | { kind: "fatal"; message: string }
  | null;
type ConfirmState = {
  open: boolean;
  message: string;
  onConfirm: () => void;
};
type AssignFeesMultiplePageProps = { onBack: () => void };

function isP7Class(className: string | null | undefined): boolean {
  const s = (className ?? "").trim().toLowerCase();
  return s.includes("p7") || s.includes("primary seven");
}

function feeStructureRowForStudent(student: StudentApiRow, rows: FeeStructureRow[]): FeeStructureRow | null {
  if (rows.length === 0) return null;
  const normalized = (student.boardingStatus ?? "").toLowerCase();
  const candidates: string[] = [];
  if (normalized === "boarding") candidates.push("boarding");
  else if (normalized === "day_full") {
    if (isP7Class(student.className)) candidates.push("day_full_p7");
    candidates.push("day_full");
  } else if (normalized === "day_half") candidates.push("day_half");
  for (const key of candidates) {
    const row = rows.find((r) => r.status === key);
    if (row) return row;
  }
  const labelHint = normalized === "boarding" ? "boarding" : normalized === "day_half" ? "half" : normalized === "day_full" ? "full" : "";
  if (labelHint) {
    const row = rows.find((r) => r.label.toLowerCase().includes(labelHint));
    if (row) return row;
  }
  return rows[0] ?? null;
}

function studentLabel(student: StudentApiRow): string {
  return `${student.fullName} (${student.admissionNumber})`;
}

function formatWithCommas(rawDigits: string): string {
  const sanitized = rawDigits.replace(/[^\d]/g, "");
  if (!sanitized) return "";
  return Number(sanitized).toLocaleString("en-UG");
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "NA";
}

function Banner({ variant, children }: { variant: BannerVariant; children: ReactNode }) {
  const variantStyle: CSSProperties =
    variant === "validation"
      ? styles.bannerValidation
      : variant === "partial"
        ? styles.bannerPartial
        : variant === "fatal"
          ? styles.bannerFatal
          : styles.bannerSuccess;
  return <div style={styles.bannerMerged(variantStyle)}>{children}</div>;
}

function BannerError({ message }: { message: string }) {
  return <Banner variant="fatal">✕ {message}</Banner>;
}

function BannerSuccess({ message }: { message: string }) {
  return <Banner variant="success">✓ {message}</Banner>;
}

function ButtonChip({
  label,
  count,
  onClick,
  disabled,
}: {
  label: string;
  count: number;
  onClick: () => void;
  disabled: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const style: CSSProperties = {
    borderRadius: 999,
    border: `1px solid ${tokens.slate200}`,
    background: hovered ? tokens.slate100 : tokens.colorSurface,
    padding: "8px 12px",
    fontWeight: 700,
    fontSize: "0.78rem",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    transition: "background 0.2s",
    fontFamily: "inherit",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseDown={() => setHovered(true)}
      aria-label={label}
    >
      {label} ({count})
    </button>
  );
}

function StudentTableRow({
  student,
  selected,
  odd,
  onToggle,
}: {
  student: StudentApiRow;
  selected: boolean;
  odd: boolean;
  onToggle: (student: StudentApiRow) => void;
}) {
  const trStyle: CSSProperties = {
    ...styles.rowBase,
    ...(selected ? styles.rowSelected : odd ? styles.rowOdd : {}),
  };
  return (
    <tr style={trStyle}>
      <td style={styles.checkboxCell}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(student)}
            style={styles.checkboxInput}
            aria-label={`Select ${student.fullName}`}
          />
        </label>
      </td>
      <td style={styles.td}>
        {student.hasPassportPhoto ? (
          <div style={styles.photoBox}>
            <AuthenticatedStudentPhoto
              studentId={student.id}
              hasPhoto={student.hasPassportPhoto}
              alt={student.fullName}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div style={styles.monogramAvatar}>{getInitials(student.fullName)}</div>
        )}
      </td>
      <td style={styles.tdStrong}>{student.fullName}</td>
      <td style={styles.td}>{student.admissionNumber}</td>
      <td style={styles.td}>{student.className ?? "—"}</td>
      <td style={styles.td}>{studentFeeStatusLabel(student)}</td>
    </tr>
  );
}

function AssignmentPreviewTable({
  selectedByTier,
  p7DayFullSelectedCount,
}: {
  selectedByTier: Array<{ key: string; label: string; students: StudentApiRow[]; amountUgx: number }>;
  p7DayFullSelectedCount: number;
}) {
  return (
    <div style={styles.previewTableWrap}>
      <p style={styles.previewTitle}>Assignment preview</p>
      <table style={styles.previewTable}>
        <tbody>
          {selectedByTier.map((tier) => (
            <tr key={tier.key}>
              <td style={styles.previewCellMain}>{tier.label}</td>
              <td style={styles.previewCellCount}>
                {tier.students.length} student{tier.students.length === 1 ? "" : "s"}
              </td>
              <td style={styles.previewCellAmount}>{formatCurrencyUGX(tier.amountUgx)}</td>
              <td style={styles.previewCellWarn}>
                {tier.key === "day_full" && p7DayFullSelectedCount > 0
                  ? "⚠ P7 students in this group will be charged the P7 full-day rate"
                  : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfirmDialog({
  open,
  message,
  onConfirm,
  onClose,
}: {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => confirmRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (evt: KeyboardEvent) => {
      if (evt.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const onKeyDown = (evt: ReactKeyboardEvent<HTMLDivElement>) => {
    if (evt.key !== "Tab") return;
    const first = cancelRef.current;
    const last = confirmRef.current;
    if (!first || !last) return;
    if (evt.shiftKey && document.activeElement === first) {
      evt.preventDefault();
      last.focus();
    } else if (!evt.shiftKey && document.activeElement === last) {
      evt.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  return (
    <div style={styles.confirmOverlay} role="dialog" aria-modal="true" aria-label="Confirm action" onKeyDown={onKeyDown}>
      <div style={styles.confirmDialog}>
        <p style={styles.confirmText}>{message}</p>
        <div style={styles.confirmActions}>
          <button ref={cancelRef} type="button" onClick={onClose} style={styles.confirmCancelBtn}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" onClick={onConfirm} style={styles.confirmAcceptBtn}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function FeeConfigSection({
  feeStructureLoading,
  feeRows,
  feeTypeStatus,
  isCustomFee,
  customFeeDescription,
  customAmountInput,
  notes,
  selectedByTier,
  assignByStudentStatus,
  p7DayFullSelectedCount,
  bulkStructureUnmapped,
  assignError,
  successMsg,
  canSubmit,
  submitting,
  bulkStudents,
  customAmountUgx,
  onFeeTypeChange,
  onCustomFeeDescriptionChange,
  onCustomAmountInputChange,
  onNotesChange,
  onAssign,
}: {
  feeStructureLoading: boolean;
  feeRows: FeeStructureRow[];
  feeTypeStatus: string;
  isCustomFee: boolean;
  customFeeDescription: string;
  customAmountInput: string;
  notes: string;
  selectedByTier: Array<{ key: string; label: string; students: StudentApiRow[]; amountUgx: number }>;
  assignByStudentStatus: boolean;
  p7DayFullSelectedCount: number;
  bulkStructureUnmapped: StudentApiRow[];
  assignError: AssignError;
  successMsg: string | null;
  canSubmit: boolean;
  submitting: boolean;
  bulkStudents: StudentApiRow[];
  customAmountUgx: number;
  onFeeTypeChange: (value: string) => void;
  onCustomFeeDescriptionChange: (value: string) => void;
  onCustomAmountInputChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onAssign: () => void;
}) {
  const estimatedTotal = isCustomFee
    ? customAmountUgx * bulkStudents.length
    : selectedByTier.reduce((sum, item) => sum + item.amountUgx * item.students.length, 0);
  const notesCounter = `${notes.length} / 300`;
  return (
    <section>
      <h3 style={styles.sectionTitle}>Step 2: Configure Fee</h3>
      <p style={styles.sectionSub}>Configure the fee and submit.</p>

      <div style={styles.blockMarginBottom}>
        <label htmlFor="feeTypeStatus" style={styles.fieldLabel}>FEE TYPE</label>
        <select id="feeTypeStatus" value={feeTypeStatus} onChange={(e) => onFeeTypeChange(e.target.value)} style={styles.fieldInput}>
          {feeStructureLoading && feeRows.length === 0 ? <option value="">Loading fee structure…</option> : null}
          {!feeStructureLoading && feeRows.length === 0 ? <option value="">No structure for this term — choose Custom fee below</option> : null}
          {feeRows.map((item) => (
            <option key={item.status} value={item.status}>
              {item.label}
            </option>
          ))}
          <option value={CUSTOM_FEE_STATUS}>Custom fee (describe &amp; set amount)</option>
        </select>
        {isCustomFee ? (
          <div style={styles.blockMarginTop10}>
            <label htmlFor="customFeeDescription" style={styles.fieldLabel}>CUSTOM FEE DESCRIPTION</label>
            <input
              id="customFeeDescription"
              value={customFeeDescription}
              onChange={(e) => onCustomFeeDescriptionChange(e.target.value)}
              placeholder="e.g. Sports levy, exam registration, trip deposit"
              style={styles.fieldInput}
            />
          </div>
        ) : null}
      </div>

      <div style={styles.feeSectionGrid}>
        <div>
          <label htmlFor="customAmountInput" style={styles.fieldLabel}>AMOUNT (UGX)</label>
          <input
            id="customAmountInput"
            readOnly={!isCustomFee}
            inputMode={isCustomFee ? "numeric" : undefined}
            value={isCustomFee ? customAmountInput : feeStructureLoading ? "…" : feeRows.length === 0 ? "—" : "Varies by student (from structure)"}
            onChange={isCustomFee ? (e) => onCustomAmountInputChange(e.target.value) : undefined}
            placeholder={isCustomFee ? "Enter amount in UGX" : undefined}
            style={isCustomFee ? styles.amountInputCustom : styles.amountInputReadonly}
          />
          <p style={styles.previewLine}>
            Total estimated: {formatCurrencyUGX(estimatedTotal)} across {bulkStudents.length} student{bulkStudents.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div>
          <label htmlFor="notes" style={styles.fieldLabel}>ADMIN NOTES</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Optional context"
            style={styles.textarea}
            maxLength={300}
          />
          <div style={styles.notesCounter}>{notesCounter}</div>
        </div>
      </div>

      {!isCustomFee && assignByStudentStatus ? (
        <AssignmentPreviewTable selectedByTier={selectedByTier} p7DayFullSelectedCount={p7DayFullSelectedCount} />
      ) : null}

      {!isCustomFee && assignByStudentStatus && bulkStructureUnmapped.length > 0 ? (
        <Banner variant="fatal">
          <p style={styles.textStrong}>
            {bulkStructureUnmapped.length} selected students have no matching fee row.
          </p>
          <div style={styles.scrollList120}>
            {bulkStructureUnmapped.map((student) => (
              <div key={student.id} style={styles.listItemStrong}>
                {studentLabel(student)}
              </div>
            ))}
          </div>
        </Banner>
      ) : null}

      <div style={styles.bannerContainer} aria-live="polite">
        {assignError?.kind === "validation" ? <Banner variant="validation">⚠ {assignError.message}</Banner> : null}
        {assignError?.kind === "partial" ? (
          <Banner variant="partial">
            <p style={styles.textStrongBottom8}>
              {assignError.successes} assigned successfully.
            </p>
            <details style={styles.detailsList}>
              <summary style={styles.detailsSummary}>{assignError.failures.length} failed — click to expand</summary>
              {assignError.failures.map((failure, idx) => (
                <div key={`${failure.student}-${idx}`} style={styles.listItemTop4}>
                  [{failure.student}]: {failure.reason}
                </div>
              ))}
            </details>
          </Banner>
        ) : null}
        {assignError?.kind === "fatal" ? <BannerError message={assignError.message} /> : null}
        {successMsg ? <BannerSuccess message={successMsg} /> : null}
      </div>

      <button type="button" onClick={onAssign} disabled={!canSubmit} style={canSubmit ? styles.submitBtnEnabled : styles.submitBtnDisabledFull}>
        {submitting ? (
          <span style={styles.spinnerWrap}>
            <svg viewBox="0 0 24 24" style={styles.spinnerInline} aria-hidden="true">
              <circle cx="12" cy="12" r="9" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
              <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                <animateTransform attributeName="transform" attributeType="xml" type="rotate" from="0 12 12" to="360 12 12" dur="0.7s" repeatCount="indefinite" />
              </path>
            </svg>
            Saving…
          </span>
        ) : bulkStudents.length > 0 ? (
          `Assign fees to ${bulkStudents.length} student${bulkStudents.length === 1 ? "" : "s"}`
        ) : (
          "Select students to assign"
        )}
      </button>
    </section>
  );
}

export function AssignFeesMultiplePage({ onBack }: AssignFeesMultiplePageProps) {
  const { viewingTerm: term, viewingAcademicYear, historicalReadOnly } = useTermContext();
  const [listSearch, setListSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [listSortBy, setListSortBy] = useState<StudentSortBy>("name");
  const [listSortDir, setListSortDir] = useState<StudentSortDir>("asc");
  const [filterClassRoomId, setFilterClassRoomId] = useState<string>("");
  const [filterStudentStatusId, setFilterStudentStatusId] = useState("");
  const [feeStatuses, setFeeStatuses] = useState<StudentStatusRow[]>([]);
  const [classrooms, setClassrooms] = useState<ClassRoomOption[]>([]);
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<StudentApiRow[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(false);
  const [bulkStudents, setBulkStudents] = useState<StudentApiRow[]>([]);
  const [feeRows, setFeeRows] = useState<FeeStructureRow[]>([]);
  const [feeTypeStatus, setFeeTypeStatus] = useState(FEE_ASSIGN_BY_STUDENT_STATUS);
  const [customFeeDescription, setCustomFeeDescription] = useState("");
  const [customAmountInput, setCustomAmountInput] = useState("");
  const [feeStructureLoading, setFeeStructureLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<AssignError>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>({ open: false, message: "", onConfirm: () => undefined });

  const bulkIdSet = useMemo(() => new Set(bulkStudents.map((s) => s.id)), [bulkStudents]);
  const isCustomFee = feeTypeStatus === CUSTOM_FEE_STATUS;
  const assignByStudentStatus = feeTypeStatus === FEE_ASSIGN_BY_STUDENT_STATUS;
  const hasMore = items.length < total;
  const supportsIntersectionObserver = typeof window !== "undefined" && "IntersectionObserver" in window;
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prevListParamsKeyRef = useRef("");
  const pendingAutoLoadRef = useRef(false);
  const confirmResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const customAmountUgx = useMemo(() => {
    const raw = customAmountInput.replace(/,/g, "").trim();
    if (!raw) return 0;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [customAmountInput]);

  const bulkStructureUnmapped = useMemo(() => {
    if (isCustomFee || !assignByStudentStatus) return [];
    return bulkStudents.filter((s) => !s.studentStatusId);
  }, [isCustomFee, assignByStudentStatus, bulkStudents]);

  const p7DayFullSelectedCount = 0;

  const selectedByTier = useMemo(() => {
    if (!assignByStudentStatus || isCustomFee) return [];
    const grouped = new Map<string, { key: string; label: string; students: StudentApiRow[]; amountUgx: number }>();
    for (const student of bulkStudents) {
      const row = feeStructureRowForStudent(student, feeRows);
      if (!row) continue;
      const key = row.status;
      const label =
        key === "boarding"
          ? "Boarding"
          : key === "day_full_p7"
            ? "Day (Full Day) - P7"
            : key === "day_full"
              ? "Day (Full Day)"
              : key === "day_half"
                ? "Day (Half Day)"
                : row.label;
      const entry = grouped.get(key) ?? { key, label, students: [], amountUgx: Math.max(Number(row.amountDueUgx) || 0, 0) };
      entry.students.push(student);
      grouped.set(key, entry);
    }
    return Array.from(grouped.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [assignByStudentStatus, isCustomFee, bulkStudents, feeRows]);

  const inViewCounts = useMemo(() => {
    const byStatus = new Map<number, number>();
    let missing = 0;
    for (const s of items) {
      if (s.studentStatusId) {
        byStatus.set(s.studentStatusId, (byStatus.get(s.studentStatusId) ?? 0) + 1);
      } else missing += 1;
    }
    return { byStatus, missing, all: items.length };
  }, [items]);

  const listParamsKey = useMemo(
    () => `${debouncedQ}|${listSortBy}|${listSortDir}|${filterClassRoomId}|${filterStudentStatusId}`,
    [debouncedQ, listSortBy, listSortDir, filterClassRoomId, filterStudentStatusId],
  );

  const allOnPageSelected = items.length > 0 && items.every((s) => bulkIdSet.has(s.id));
  const someOnPageSelected = items.some((s) => bulkIdSet.has(s.id));
  const hasActiveFilters =
    listSearch.trim() !== "" ||
    filterClassRoomId !== "" ||
    filterStudentStatusId !== "" ||
    listSortBy !== "name" ||
    listSortDir !== "asc";

  const canSubmit =
    !historicalReadOnly &&
    bulkStudents.length > 0 &&
    !submitting &&
    (isCustomFee
      ? customFeeDescription.trim().length > 0 && customAmountUgx > 0
      : !feeStructureLoading && feeRows.length > 0 && assignByStudentStatus);

  useLayoutEffect(() => {
    const el = selectAllCheckboxRef.current;
    if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
  }, [someOnPageSelected, allOnPageSelected]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(listSearch.trim()), 350);
    return () => window.clearTimeout(t);
  }, [listSearch]);

  useEffect(() => {
    let cancelled = false;
    void fetchStudentStatuses()
      .then((rows) => {
        if (!cancelled) setFeeStatuses(rows.filter((x) => !x.archivedAt));
      })
      .catch(() => {
        if (!cancelled) setFeeStatuses([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchClassrooms()
      .then((rows) => {
        if (!cancelled) setClassrooms(rows.filter((r) => r.isActive !== false));
      })
      .catch(() => {
        if (!cancelled) setClassrooms([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const paramsChanged = prevListParamsKeyRef.current !== listParamsKey;
    prevListParamsKeyRef.current = listParamsKey;
    if (paramsChanged && offset !== 0) {
      setItems([]);
      setOffset(0);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    const fetchOffset = paramsChanged ? 0 : offset;
    const classIdParsed = filterClassRoomId.trim() === "" ? Number.NaN : Number.parseInt(filterClassRoomId, 10);
    const classRoomId = Number.isFinite(classIdParsed) && classIdParsed > 0 ? classIdParsed : undefined;
    const statusFilter =
      filterStudentStatusId === "missing"
        ? { missingStatus: true as const }
        : filterStudentStatusId.trim() !== ""
          ? { studentStatusId: Number.parseInt(filterStudentStatusId, 10) }
          : {};

    void fetchStudents({
      q: debouncedQ || undefined,
      sortBy: listSortBy,
      sortDir: listSortDir,
      classRoomId,
      ...statusFilter,
      limit: PAGE_SIZE,
      offset: fetchOffset,
    })
      .then((res) => {
        if (cancelled) return;
        setItems((prev) => (fetchOffset === 0 ? res.items : [...prev, ...res.items]));
        setTotal(res.total);
      })
      .catch(() => {
        if (!cancelled && fetchOffset === 0) {
          setItems([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [listParamsKey, offset, filterClassRoomId, filterStudentStatusId, listSortBy, listSortDir, debouncedQ]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    const loadStructure = async () => {
      setFeeStructureLoading(true);
      try {
        const rows = await fetchFeeStructure(term);
        if (cancelled) return;
        setAssignError(null);
        setFeeRows(rows);
        if (rows.length === 0) setFeeTypeStatus((prev) => (prev === CUSTOM_FEE_STATUS ? prev : ""));
        else setFeeTypeStatus((prev) => (prev === CUSTOM_FEE_STATUS ? prev : FEE_ASSIGN_BY_STUDENT_STATUS));
      } catch (e) {
        if (!cancelled) {
          setFeeRows([]);
          setFeeTypeStatus((prev) => (prev === CUSTOM_FEE_STATUS ? prev : ""));
          setAssignError({ kind: "fatal", message: e instanceof Error ? e.message : "Failed to load fee structure." });
          setSuccessMsg(null);
        }
      } finally {
        if (!cancelled) setFeeStructureLoading(false);
      }
    };
    void loadStructure();
    timer = setInterval(() => void loadStructure(), 30000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [term]);

  useEffect(() => {
    if (!supportsIntersectionObserver || !sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry?.isIntersecting) return;
      if (hasMore && !listLoading && !pendingAutoLoadRef.current) {
        pendingAutoLoadRef.current = true;
        setOffset((o) => o + PAGE_SIZE);
      }
    });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [supportsIntersectionObserver, hasMore, listLoading]);

  useEffect(() => {
    if (!listLoading) pendingAutoLoadRef.current = false;
  }, [listLoading]);

  const clearBanners = useCallback(() => {
    setAssignError(null);
    setSuccessMsg(null);
  }, []);

  const requestConfirm = useCallback((message: string): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      confirmResolverRef.current = resolve;
      setConfirmState({
        open: true,
        message,
        onConfirm: () => {
          confirmResolverRef.current?.(true);
          confirmResolverRef.current = null;
          setConfirmState({ open: false, message: "", onConfirm: () => undefined });
        },
      });
    });
  }, []);

  const closeConfirm = useCallback(() => {
    if (confirmResolverRef.current) {
      confirmResolverRef.current(false);
      confirmResolverRef.current = null;
    }
    setConfirmState({ open: false, message: "", onConfirm: () => undefined });
  }, []);

  const toggleBulkStudent = useCallback(
    (student: StudentApiRow) => {
      setBulkStudents((prev) => (prev.some((s) => s.id === student.id) ? prev.filter((s) => s.id !== student.id) : [...prev, student]));
      clearBanners();
    },
    [clearBanners],
  );

  const clearBulkSelection = useCallback(() => {
    setBulkStudents([]);
    clearBanners();
  }, [clearBanners]);

  const appendStudents = useCallback(
    (rows: StudentApiRow[]) => {
      setBulkStudents((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const row of rows) map.set(row.id, row);
        return Array.from(map.values());
      });
      clearBanners();
    },
    [clearBanners],
  );

  const addStudentsByStatus = useCallback(
    (key: QuickSelectKey) => {
      if (key === "all") {
        appendStudents(items);
        return;
      }
      if (key === "missing") {
        appendStudents(items.filter((s) => !s.studentStatusId));
        return;
      }
      appendStudents(items.filter((s) => s.studentStatusId === key));
    },
    [appendStudents, items],
  );

  const toggleSelectAllOnPage = useCallback(() => {
    if (allOnPageSelected) {
      const pageIds = new Set(items.map((s) => s.id));
      setBulkStudents((prev) => prev.filter((s) => !pageIds.has(s.id)));
    } else appendStudents(items);
    clearBanners();
  }, [allOnPageSelected, appendStudents, items, clearBanners]);

  const resetFilters = useCallback(() => {
    setListSearch("");
    setFilterClassRoomId("");
    setFilterStudentStatusId("");
    setListSortBy("name");
    setListSortDir("asc");
  }, []);

  const onCustomAmountChange = useCallback((inputValue: string) => {
    const raw = inputValue.replace(/[^\d]/g, "");
    setCustomAmountInput(formatWithCommas(raw));
  }, []);

  const handleAssign = useCallback(async (): Promise<void> => {
    clearBanners();
    if (historicalReadOnly) {
      setAssignError({ kind: "validation", message: "This term is locked. Only administrators can assign fees outside the current term." });
      return;
    }
    if (bulkStudents.length === 0) {
      setAssignError({ kind: "validation", message: "Select at least one student using the checkboxes." });
      return;
    }
    if (isCustomFee) {
      if (!customFeeDescription.trim()) {
        setAssignError({ kind: "validation", message: "Enter a description for the custom fee." });
        return;
      }
      if (customAmountUgx <= 0) {
        setAssignError({ kind: "validation", message: "Enter a valid amount greater than 0 UGX." });
        return;
      }
    } else if (!assignByStudentStatus) {
      setAssignError({ kind: "validation", message: "Choose “By student status (fee rules)” or Custom fee." });
      return;
    }

    if (!isCustomFee && assignByStudentStatus && bulkStructureUnmapped.length > 0) {
      const proceed = await requestConfirm(`${bulkStructureUnmapped.length} selected students have no student status — they will be skipped. Continue?`);
      if (!proceed) return;
    }

    if (bulkStudents.length > 1) {
      const confirmMsg = isCustomFee
        ? `Assign ${formatCurrencyUGX(customAmountUgx)} to ${bulkStudents.length} students for ${term}?\n\n${bulkStudents.map((s) => studentLabel(s)).join("\n")}`
        : `Generate ${term} fee line items from fee rules for ${bulkStudents.length} students? Each total follows their configured student status.\n\n${bulkStudents.map((s) => studentLabel(s)).join("\n")}`;
      const ok = await requestConfirm(confirmMsg);
      if (!ok) return;
    }

    setSubmitting(true);
    try {
      const failures: { student: string; reason: string }[] = [];
      for (const student of bulkStudents) {
        try {
          if (isCustomFee) {
            const notesPayload = [`Custom fee: ${customFeeDescription.trim()}`, notes.trim()].filter(Boolean).join(" | ");
            await assignStudentFee({ studentId: student.id, term, amountDueUgx: customAmountUgx, notes: notesPayload || undefined });
          } else if (!student.studentStatusId) {
            failures.push({ student: studentLabel(student), reason: "No student status" });
            continue;
          } else {
            await generateStudentLineItems(student.id, term, viewingAcademicYear);
          }
        } catch (err) {
          failures.push({ student: studentLabel(student), reason: err instanceof Error ? err.message : "Failed" });
        }
      }

      const successes = bulkStudents.length - failures.length;
      if (failures.length > 0) setAssignError({ kind: "partial", successes, failures });
      if (successes > 0) {
        setSuccessMsg(
          isCustomFee
            ? `Assigned ${formatCurrencyUGX(customAmountUgx)} for ${term} to ${successes} of ${bulkStudents.length} student(s).`
            : `Generated ${term} fee line items (by student status rules) for ${successes} of ${bulkStudents.length} student(s).`,
        );
        if (failures.length === 0) {
          setNotes("");
          if (isCustomFee) {
            setCustomFeeDescription("");
            setCustomAmountInput("");
          }
          clearBulkSelection();
        }
      }
    } catch (e) {
      setSuccessMsg(null);
      setAssignError({ kind: "fatal", message: e instanceof Error ? e.message : "Failed to assign fees." });
    } finally {
      setSubmitting(false);
    }
  }, [
    clearBanners,
    historicalReadOnly,
    bulkStudents,
    isCustomFee,
    customFeeDescription,
    customAmountUgx,
    assignByStudentStatus,
    bulkStructureUnmapped.length,
    requestConfirm,
    term,
    viewingAcademicYear,
    notes,
    clearBulkSelection,
  ]);

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.headerWrap}>
          <div>
            <button type="button" onClick={onBack} style={styles.backBtn}>
              ← Back to single assign
            </button>
            <h2 style={styles.title}>Assign fees to multiple students</h2>
            <p style={styles.subtitle}>Select learners first, then configure fee assignment below.</p>
            {historicalReadOnly ? <div style={styles.readOnlyBanner}>🔒 This term is read-only. Fee assignment is disabled.</div> : null}
          </div>
          <div style={bulkStudents.length > 0 ? styles.selectedBadgeOn : styles.selectedBadgeIdle}>
            {bulkStudents.length} students selected
          </div>
        </div>

        <section style={styles.sectionStepWrap}>
          <h3 style={styles.sectionTitle}>Step 1: Select Students</h3>
          <p style={styles.sectionSub}>Use filters, then quick-select by status or pick students manually.</p>

          <div style={styles.filterRow}>
            <div style={styles.fieldWrap}>
              <label htmlFor="listSearch" style={styles.fieldLabel}>FILTER STUDENTS</label>
              <input id="listSearch" value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder="Name or admission number" style={styles.fieldInput} />
            </div>
            <div style={styles.fieldWrap}>
              <label htmlFor="filterClassRoomId" style={styles.fieldLabel}>CLASS</label>
              <select id="filterClassRoomId" value={filterClassRoomId} onChange={(e) => setFilterClassRoomId(e.target.value)} style={styles.fieldInput}>
                <option value="">All classes</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.fieldWrap}>
              <label htmlFor="filterStudentStatusId" style={styles.fieldLabel}>
                STUDENT STATUS (FEES)
              </label>
              <select
                id="filterStudentStatusId"
                value={filterStudentStatusId}
                onChange={(e) => setFilterStudentStatusId(e.target.value)}
                style={styles.fieldInput}
              >
                <option value="">All statuses</option>
                <option value="missing">Missing status</option>
                {feeStatuses.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={styles.fieldWrap}>
              <label htmlFor="listSortBy" style={styles.fieldLabel}>SORT BY</label>
              <select id="listSortBy" value={listSortBy} onChange={(e) => setListSortBy(e.target.value as StudentSortBy)} style={styles.fieldInput}>
                <option value="name">Name</option>
                <option value="class">Class</option>
                <option value="boarding">Status</option>
                <option value="date">Date admitted</option>
                <option value="id">Admission ID</option>
              </select>
            </div>
            <div style={styles.fieldWrap}>
              <label htmlFor="listSortDir" style={styles.fieldLabel}>ORDER</label>
              <select id="listSortDir" value={listSortDir} onChange={(e) => setListSortDir(e.target.value as StudentSortDir)} style={styles.fieldInput}>
                <option value="asc">A → Z / low → high</option>
                <option value="desc">Z → A / high → low</option>
              </select>
            </div>
            <div style={styles.fieldWrap}>
              <label style={styles.fieldLabel}>TERM</label>
              <div style={styles.termBadge}>{term}</div>
            </div>
            {hasActiveFilters ? (
              <button type="button" onClick={resetFilters} style={styles.resetFiltersBtn}>
                Reset filters
              </button>
            ) : null}
          </div>

          <div style={styles.chipRow}>
            {feeStatuses.map((s) => (
              <ButtonChip
                key={s.id}
                label={`Select ${s.code}`}
                count={inViewCounts.byStatus.get(s.id) ?? 0}
                onClick={() => addStudentsByStatus(s.id)}
                disabled={listLoading}
              />
            ))}
            <ButtonChip
              label="Select missing status"
              count={inViewCounts.missing}
              onClick={() => addStudentsByStatus("missing")}
              disabled={listLoading}
            />
            <ButtonChip
              label="Select all in view"
              count={inViewCounts.all}
              onClick={() => addStudentsByStatus("all")}
              disabled={listLoading}
            />
          </div>

          <div style={styles.tableWrap}>
            <div style={styles.tableToolbar}>
              <span>{listLoading ? "Loading…" : `Showing ${items.length} of ${total} students`}</span>
              <div style={styles.tableToolbarActions}>
                <label style={styles.selectAllLabel}>
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleSelectAllOnPage}
                    aria-label="Select all loaded students"
                  />
                  Select all loaded
                </label>
                <button type="button" onClick={clearBulkSelection} style={styles.clearBtn}>
                  Clear selection
                </button>
              </div>
            </div>

            <div style={styles.tableScroll}>
              <table style={styles.table}>
                <colgroup>
                  <col style={styles.colSel} />
                  <col style={styles.colPhoto} />
                  <col />
                  <col style={styles.colAdmission} />
                  <col style={styles.colClass} />
                  <col style={styles.colStatus} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" style={styles.thSel}>Sel.</th>
                    <th scope="col" style={styles.th}>Photo</th>
                    <th scope="col" style={styles.th}>Name</th>
                    <th scope="col" style={styles.th}>Admission #</th>
                    <th scope="col" style={styles.th}>Class</th>
                    <th scope="col" style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((student, idx) => (
                    <StudentTableRow
                      key={student.id}
                      student={student}
                      selected={bulkIdSet.has(student.id)}
                      odd={idx % 2 === 1}
                      onToggle={toggleBulkStudent}
                    />
                  ))}
                </tbody>
              </table>
              {!listLoading && items.length === 0 ? <p style={styles.emptyState}>No students match this filter.</p> : null}
              <div ref={sentinelRef} style={styles.sentinel} />
            </div>

            {hasMore && !supportsIntersectionObserver ? (
              <div style={styles.loadMoreWrap}>
                <button
                  type="button"
                  onClick={() => setOffset((o) => o + PAGE_SIZE)}
                  disabled={listLoading}
                  style={listLoading ? styles.loadMoreBtnDisabled : styles.loadMoreBtnEnabled}
                >
                  Load more
                </button>
              </div>
            ) : null}
          </div>
        </section>

        <div style={styles.divider} />

        <FeeConfigSection
          feeStructureLoading={feeStructureLoading}
          feeRows={feeRows}
          feeTypeStatus={feeTypeStatus}
          isCustomFee={isCustomFee}
          customFeeDescription={customFeeDescription}
          customAmountInput={customAmountInput}
          notes={notes}
          selectedByTier={selectedByTier}
          assignByStudentStatus={assignByStudentStatus}
          p7DayFullSelectedCount={p7DayFullSelectedCount}
          bulkStructureUnmapped={bulkStructureUnmapped}
          assignError={assignError}
          successMsg={successMsg}
          canSubmit={canSubmit}
          submitting={submitting}
          bulkStudents={bulkStudents}
          customAmountUgx={customAmountUgx}
          onFeeTypeChange={(value) => {
            setFeeTypeStatus(value);
            clearBanners();
          }}
          onCustomFeeDescriptionChange={setCustomFeeDescription}
          onCustomAmountInputChange={onCustomAmountChange}
          onNotesChange={setNotes}
          onAssign={() => void handleAssign()}
        />
      </div>
      <ConfirmDialog
        open={confirmState.open}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onClose={closeConfirm}
      />
    </div>
  );
}
