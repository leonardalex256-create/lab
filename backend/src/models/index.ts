import {
  Sequelize,
  DataTypes,
  Model,
  fn,
  col,
  where,
} from "sequelize";
import type { Config } from "../config.js";
import {
  initFeeConfigModels,
  associateFeeConfigModels,
  StudentStatus,
  FeeCategory,
  FeeCategoryStatus,
  FeeRule,
  StudentFeeLineItem,
} from "./feeConfigModels.js";

export {
  StudentStatus,
  FeeCategory,
  FeeCategoryStatus,
  FeeRule,
  StudentFeeLineItem,
} from "./feeConfigModels.js";

export class User extends Model {
  declare id: number;
  declare fullName: string | null;
  declare email: string;
  declare phoneNumber: string | null;
  declare gender: string | null;
  declare dateOfBirth: string | null;
  declare addressLine: string | null;
  declare passwordHash: string;
  declare role: string;
  declare twoFactorEnabled: boolean;
  declare isActive: boolean;
  declare isDeleted: boolean;
  declare readonly createdAt: Date;
}

/** Short-lived email OTP for login 2FA, password change, and 2FA toggles. */
export class SecurityOtpChallenge extends Model {
  declare id: number;
  declare userId: number;
  declare purpose: string;
  declare codeHash: string;
  declare expiresAt: Date;
  declare readonly createdAt: Date;
}

export class ClassRoom extends Model {
  declare id: number;
  declare name: string;
  declare categoryId: number | null;
  declare description: string | null;
  declare isActive: boolean;
  declare academicYear: string;
  declare readonly createdAt: Date;
}

export class ClassCategory extends Model {
  declare id: number;
  declare name: string;
  declare description: string | null;
  declare readonly createdAt: Date;
}

export class ClassSection extends Model {
  declare id: number;
  declare classRoomId: number;
  declare name: string;
  declare classTeacherName: string | null;
  declare academicYear: string;
  declare readonly createdAt: Date;
}

export class UserClassAuthorization extends Model {
  declare id: number;
  declare userId: number;
  declare classRoomId: number;
  declare readonly createdAt: Date;
}

export class Student extends Model {
  declare id: number;
  declare admissionNumber: string;
  declare firstName: string;
  declare middleName: string | null;
  declare lastName: string;
  declare dateOfBirth: string | null;
  declare parentEmail: string | null;
  declare classRoomId: number | null;
  declare gender: string | null;
  declare sectionName: string | null;
  declare passportPhotoFilename: string | null;
  declare nationality: string | null;
  declare countryCode: string | null;
  declare district: string | null;
  declare registrationType: string;
  declare previousSchool: string | null;
  declare previousSchoolLocation: string | null;
  declare lastClassAttended: string | null;
  declare lastTermYear: string | null;
  declare previousReportCardFilename: string | null;
  declare previousGrades: string | null;
  declare transferReason: string | null;
  declare parentAliveStatus: "both" | "one" | "none" | null;
  declare parentFullName: string | null;
  declare parentPhone: string | null;
  declare parentAddress: string | null;
  declare religion: string | null;
  declare specialNeeds: string | null;
  declare boardingStatus: string | null;
  declare studentStatusId: number | null;
  declare registrationDraftJson: string | null;
  declare residenceAddress: string | null;
  declare medicalInfo: string | null;
  declare emergencyContactName: string | null;
  declare emergencyContactPhone: string | null;
  declare guardianName: string | null;
  declare guardianPhone: string | null;
  declare bursaryPercentage: number;
  declare bursaryStartsAt: Date | null;
  declare bursaryEndsAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export class StudentAssessmentResult extends Model {
  declare id: number;
  declare studentId: number;
  declare classRoomId: number;
  declare sectionName: string | null;
  declare academicYear: string;
  declare term: string;
  declare examType: string;
  declare subject: string;
  declare score: number;
  declare remarks: string | null;
  declare enteredByUserId: number | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export class AcademicExamType extends Model {
  declare id: number;
  declare examKey: string;
  declare displayName: string;
  declare isSystem: boolean;
  declare isActive: boolean;
  declare readonly createdAt: Date;
}

export class AcademicSubjectAssignment extends Model {
  declare id: number;
  declare classCategoryId: number;
  declare sectionName: string | null;
  declare subjectName: string;
  declare shortForm: string;
  declare readonly createdAt: Date;
}

export class Exam extends Model {
  declare id: number;
  declare examKey: string;
  declare classRoomId: number;
  declare subject: string;
  declare examDate: string;
  declare readonly createdAt: Date;
}

export class StudentFeeReceipt extends Model {
  declare id: number;
  declare studentId: number;
  declare receiptNo: string;
  declare academicYear: string;
  declare term: string;
  declare paymentMethod: string;
  declare paidBy: string;
  declare amountPaidUgx: number;
  declare previousPaidUgx: number;
  declare totalFeesDueUgx: number;
  declare outstandingAfterUgx: number;
  declare creditAmountUgx: number;
  declare readonly createdAt: Date;
}

export class StudentFeeAssignment extends Model {
  declare id: number;
  declare studentId: number;
  declare academicYear: string;
  declare term: string;
  declare amountDueUgx: number;
  declare notes: string | null;
  declare readonly createdAt: Date;
}

export class StudentFeeStructure extends Model {
  declare id: number;
  declare term: string;
  declare boardingStatus: "day_half" | "day_full" | "day_full_p7" | "boarding";
  declare amountDueUgx: number;
  declare notes: string | null;
  declare readonly createdAt: Date;
}

export class StudentFeePayment extends Model {
  declare id: number;
  declare studentId: number;
  declare academicYear: string;
  declare term: string;
  declare amountPaidUgx: number;
  declare paymentMethod: string;
  declare paidBy: string;
  declare receiptId: number | null;
  declare readonly createdAt: Date;
  declare changeReason: string | null;
  declare allocatesPriorTerms: boolean;
  declare note: string | null;
  declare paymentDate: string | null;
}

export class DailyExpenseEntry extends Model {
  declare id: number;
  declare expenseDate: string;
  declare category: string;
  declare description: string;
  declare amountUgx: number;
  declare paymentMethod: string;
  declare recordedByUserId: number | null;
  declare readonly createdAt: Date;
}

export class DailyFinanceReport extends Model {
  declare id: number;
  declare reportDate: string;
  declare status: "not_submitted" | "submitted" | "admin_review" | "closed";
  declare submittedByUserId: number | null;
  declare submittedAt: Date | null;
  declare reviewedByUserId: number | null;
  declare reviewedAt: Date | null;
  declare closedByUserId: number | null;
  declare closedAt: Date | null;
  declare reopenedReason: string | null;
  declare reopenedForUserId: number | null;
  declare isReopened: boolean;
  declare adminNotes: string | null;
}

export class DailyFinanceReportAudit extends Model {
  declare id: number;
  declare reportId: number;
  declare action: string;
  declare actorUserId: number | null;
  declare note: string | null;
  declare readonly createdAt: Date;
}

export class StaffPayrollEntry extends Model {
  declare id: number;
  declare staffMemberId: number | null;
  declare monthKey: string;
  declare grossAmountUgx: number;
  declare paidAmountUgx: number;
  declare arrearsUgx: number;
  declare status: string;
  declare readonly createdAt: Date;
}

export class PasswordResetOtp extends Model {
  declare id: number;
  declare emailLower: string;
  declare codeHash: string;
  declare expiresAt: Date;
  declare readonly createdAt: Date;
}

/** In-app notifications for a user (header bell). */
export class UserNotification extends Model {
  declare id: number;
  declare userId: number;
  declare title: string;
  declare body: string;
  /** Null = unread. */
  declare readAt: Date | null;
  declare readonly createdAt: Date;
}

/** In-app messages for a user (header mail). */
export class UserMessage extends Model {
  declare id: number;
  declare recipientUserId: number;
  declare senderUserId: number | null;
  /** List headline (e.g. sender name); required even if sender_user_id is set. */
  declare title: string;
  declare body: string;
  declare readAt: Date | null;
  declare readonly createdAt: Date;
}

export class StaffMember extends Model {
  declare id: number;
  declare userId: number | null;
  declare staffType: string;
  declare displayName: string;
  declare email: string | null;
  declare staffRole: string;
  declare phone: string | null;
  declare address: string | null;
  declare gender: string | null;
  declare dateOfBirth: string | null;
  declare nationality: string | null;
  declare maritalStatus: string | null;
  declare nationalId: string | null;
  declare qualification: string | null;
  declare languages: string | null;
  declare dateOfJoining: string | null;
  declare experience: string | null;
  declare emergencyContactName: string | null;
  declare emergencyContactPhone: string | null;
  declare refereeName: string | null;
  declare refereeContact: string | null;
  declare staffPhotoUrl: string | null;
  declare staffPhotoName: string | null;
  declare assignedClass: string | null;
  declare teachingSection: string | null;
  declare staffCategory: string | null;
  declare nationalIdPhotoUrl: string | null;
  declare nationalIdPhotoName: string | null;
  declare updatedAt: Date;
  declare readonly createdAt: Date;
}

export class Enquiry extends Model {
  declare id: number;
  declare subject: string;
  declare messageBody: string;
  declare sourceEmail: string | null;
  declare status: string;
  declare readonly createdAt: Date;
}

export class NoticeBoardEntry extends Model {
  declare id: number;
  declare authorUserId: number | null;
  declare authorLabel: string;
  declare title: string;
  declare body: string;
  declare type: "function" | "assignment" | "general";
  declare eventDate: string | null;
  declare publishedAt: Date;
  declare readonly createdAt: Date;

  declare comments?: NoticeBoardComment[];
}

export class NoticeBoardComment extends Model {
  declare id: number;
  declare noticeId: number;
  declare userId: number;
  declare authorName: string;
  declare body: string;
  declare readonly createdAt: Date;

  declare notice?: NoticeBoardEntry;
}

export class SchoolExpense extends Model {
  declare id: number;
  declare referenceCode: string;
  declare expenseType: string;
  declare amountUgx: number;
  declare status: string;
  declare contactEmail: string;
  declare expenseDate: string;
  /** When the row was inserted (for intra-day ordering on daily finance views). */
  declare readonly createdAt: Date;
}

export class SchoolEvent extends Model {
  declare id: number;
  declare title: string;
  declare eventDate: string;
  declare readonly createdAt: Date;
}

export class DashboardChartPoint extends Model {
  declare id: number;
  declare sortOrder: number;
  declare xPos: number;
  declare yPos: number;
}

export class SocialPlatformStat extends Model {
  declare id: number;
  declare platformKey: string;
  declare displayLabel: string;
  declare followerCount: number;
  declare sortOrder: number;
}

export class AttendanceRecord extends Model {
  declare id: number;
  declare studentId: number;
  declare recordDate: string;
  declare present: boolean;
  declare readonly createdAt: Date;
}

export class DashboardKpi extends Model {
  declare kpiKey: string;
  declare valueText: string;
}

export class RolePermission extends Model {
  declare id: number;
  declare role: string;
  declare permissionKey: string;
}

export class UserPermissionOverride extends Model {
  declare id: number;
  declare userId: number;
  declare permissionKey: string;
  declare allowed: boolean;
}

export class SchoolSetting extends Model {
  declare settingKey: string;
  declare settingValue: string | null;
  declare readonly updatedAt: Date;
}

export function setupDatabase(config: Config): Sequelize {
  const sequelize = new Sequelize({
    dialect: "mysql",
    host: config.DB_HOST,
    port: config.DB_PORT,
    username: config.DB_USER,
    password: config.DB_PASSWORD === "" ? undefined : config.DB_PASSWORD,
    database: config.DB_NAME,
    logging: config.NODE_ENV === "development" && process.env.DB_LOGGING === "true" ? console.log : false,
  });

  User.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      // Uniqueness: DB `uq_users_email` (schema.sql). Omit `unique: true` here so
      // `sequelize.sync({ alter: true })` does not emit CHANGE … UNIQUE and hit MySQL
      // ER_TOO_MANY_KEYS when a unique index already exists.
      fullName: { type: DataTypes.STRING(120), allowNull: true, field: "full_name" },
      email: { type: DataTypes.STRING(255), allowNull: false },
      phoneNumber: { type: DataTypes.STRING(32), allowNull: true, field: "phone_number" },
      gender: { type: DataTypes.STRING(32), allowNull: true },
      dateOfBirth: { type: DataTypes.DATEONLY, allowNull: true, field: "date_of_birth" },
      addressLine: { type: DataTypes.STRING(255), allowNull: true, field: "address_line" },
      passwordHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "password_hash",
      },
      role: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "admin",
      },
      twoFactorEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "two_factor_enabled",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_active",
      },
      isDeleted: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_deleted",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "users",
      modelName: "User",
      timestamps: false,
      indexes: [
        { fields: ["is_deleted", "role"] },
        { fields: ["email"] },
      ],
    },
  );

  ClassRoom.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(120), allowNull: false },
      categoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "category_id",
      },
      description: { type: DataTypes.STRING(255), allowNull: true },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_active",
      },
      academicYear: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "academic_year",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "classrooms",
      modelName: "ClassRoom",
      timestamps: false,
    },
  );

  ClassCategory.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: { type: DataTypes.STRING(80), allowNull: false },
      description: { type: DataTypes.STRING(255), allowNull: true },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "class_categories",
      modelName: "ClassCategory",
      timestamps: false,
    },
  );

  ClassSection.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      classRoomId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "class_room_id",
      },
      name: { type: DataTypes.STRING(80), allowNull: false },
      classTeacherName: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: "class_teacher_name",
      },
      academicYear: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "academic_year",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "class_sections",
      modelName: "ClassSection",
      timestamps: false,
    },
  );

  UserClassAuthorization.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "user_id",
      },
      classRoomId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "class_room_id",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "user_class_authorizations",
      modelName: "UserClassAuthorization",
      timestamps: false,
      indexes: [
        {
          name: "uq_user_class_authorizations_user_class",
          unique: true,
          fields: ["user_id", "class_room_id"],
        },
      ],
    },
  );

  Student.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      admissionNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: "admission_number",
      },
      firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "first_name",
      },
      middleName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: "middle_name",
      },
      lastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: "last_name",
      },
      dateOfBirth: { type: DataTypes.DATEONLY, field: "date_of_birth" },
      parentEmail: { type: DataTypes.STRING(255), field: "parent_email" },
      classRoomId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: "class_room_id",
      },
      gender: { type: DataTypes.STRING(20), allowNull: true },
      sectionName: { type: DataTypes.STRING(80), field: "section_name" },
      passportPhotoFilename: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "passport_photo_filename",
      },
      nationality: { type: DataTypes.STRING(100), allowNull: true },
      countryCode: {
        type: DataTypes.STRING(10),
        allowNull: true,
        field: "country_code",
      },
      district: { type: DataTypes.STRING(120), allowNull: true },
      registrationType: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "first",
        field: "registration_type",
      },
      previousSchool: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: "previous_school",
      },
      previousSchoolLocation: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: "previous_school_location",
      },
      lastClassAttended: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: "last_class_attended",
      },
      lastTermYear: {
        type: DataTypes.STRING(40),
        allowNull: true,
        field: "last_term_year",
      },
      previousReportCardFilename: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "previous_report_card_filename",
      },
      previousGrades: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "previous_grades",
      },
      transferReason: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: "transfer_reason",
      },
      parentAliveStatus: {
        type: DataTypes.STRING(16),
        allowNull: true,
        field: "parent_alive_status",
      },
      parentFullName: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: "parent_full_name",
      },
      parentPhone: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: "parent_phone",
      },
      parentAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "parent_address",
      },
      religion: {
        type: DataTypes.STRING(80),
        allowNull: true,
      },
      specialNeeds: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "special_needs",
      },
      boardingStatus: {
        type: DataTypes.STRING(16),
        allowNull: true,
        field: "boarding_status",
      },
      studentStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "student_status_id",
      },
      registrationDraftJson: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "registration_draft_json",
      },
      residenceAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "residence_address",
      },
      medicalInfo: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "medical_info",
      },
      emergencyContactName: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: "emergency_contact_name",
      },
      emergencyContactPhone: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: "emergency_contact_phone",
      },
      guardianName: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: "guardian_name",
      },
      guardianPhone: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: "guardian_phone",
      },
      bursaryPercentage: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "bursary_percentage",
      },
      bursaryStartsAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "bursary_starts_at",
      },
      bursaryEndsAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "bursary_ends_at",
      },
    },
    {
      sequelize,
      tableName: "students",
      modelName: "Student",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        { fields: ["admission_number"], unique: true },
        { fields: ["class_room_id"] },
        { fields: ["first_name", "last_name"] },
        { fields: ["parent_email"] },
        { fields: ["student_status_id"] },
      ],

    },
  );

  StudentAssessmentResult.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      studentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "student_id",
      },
      classRoomId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "class_room_id",
      },
      sectionName: {
        type: DataTypes.STRING(80),
        allowNull: false,
        defaultValue: "",
        field: "section_name",
      },
      academicYear: {
        type: DataTypes.STRING(4),
        allowNull: false,
        field: "academic_year",
      },
      term: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      examType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: "exam_type",
      },
      subject: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      score: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
      },
      remarks: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      enteredByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "entered_by_user_id",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "student_assessment_results",
      modelName: "StudentAssessmentResult",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "uq_student_assessment_results_student_year_term_exam_subject",
          unique: true,
          fields: ["student_id", "academic_year", "term", "exam_type", "subject"],
        },
        {
          name: "student_assessment_results_year_term_class_idx",
          fields: ["academic_year", "term", "class_room_id"],
        },
      ],
    },
  );

  AcademicExamType.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      examKey: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "exam_key",
      },
      displayName: {
        type: DataTypes.STRING(80),
        allowNull: false,
        field: "display_name",
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_system",
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_active",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "academic_exam_types",
      modelName: "AcademicExamType",
      timestamps: false,
      indexes: [{ name: "uq_academic_exam_types_exam_key", unique: true, fields: ["exam_key"] }],
    },
  );

  AcademicSubjectAssignment.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      classCategoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "class_category_id",
      },
      sectionName: {
        type: DataTypes.STRING(80),
        allowNull: true,
        field: "section_name",
      },
      subjectName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "subject_name",
      },
      shortForm: {
        type: DataTypes.STRING(8),
        allowNull: false,
        field: "short_form",
        defaultValue: "",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "academic_subject_assignments",
      modelName: "AcademicSubjectAssignment",
      timestamps: false,
      indexes: [
        {
          name: "uq_subject_assignment_category_section_subject",
          unique: true,
          fields: ["class_category_id", "section_name", "subject_name"],
        },
      ],
    },
  );

  StudentFeeReceipt.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      studentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "student_id",
      },
      receiptNo: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: "receipt_no",
      },
      academicYear: {
        type: DataTypes.STRING(4),
        allowNull: false,
        field: "academic_year",
      },
      term: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      paymentMethod: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "payment_method",
      },
      paidBy: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "paid_by",
      },
      amountPaidUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: "amount_paid_ugx",
      },
      previousPaidUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        field: "previous_paid_ugx",
      },
      totalFeesDueUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        field: "total_fees_due_ugx",
      },
      outstandingAfterUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        field: "outstanding_after_ugx",
      },
      creditAmountUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        field: "credit_amount_ugx",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "student_fee_receipts",
      modelName: "StudentFeeReceipt",
      timestamps: false,
    },
  );

  StudentFeeAssignment.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      studentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "student_id",
      },
      academicYear: {
        type: DataTypes.STRING(4),
        allowNull: false,
        field: "academic_year",
      },
      term: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      amountDueUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: "amount_due_ugx",
      },
      notes: { type: DataTypes.STRING(255), allowNull: true },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "student_fee_assignments",
      modelName: "StudentFeeAssignment",
      timestamps: false,
      indexes: [
        {
          name: "uq_student_fee_assignments_student_year_term",
          unique: true,
          fields: ["student_id", "academic_year", "term"],
        },
      ],
    },
  );

  StudentFeeStructure.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      term: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      boardingStatus: {
        type: DataTypes.STRING(60),
        allowNull: false,
        field: "boarding_status",
      },
      label: {
        type: DataTypes.STRING(120),
        allowNull: true,
      },
      amountDueUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: "amount_due_ugx",
      },
      notes: { type: DataTypes.STRING(255), allowNull: true },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "student_fee_structures",
      modelName: "StudentFeeStructure",
      timestamps: false,
      indexes: [
        {
          name: "uq_student_fee_structures_term_status",
          unique: true,
          fields: ["term", "boarding_status"],
        },
      ],
    },
  );

  StudentFeePayment.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      studentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "student_id",
      },
      academicYear: {
        type: DataTypes.STRING(4),
        allowNull: false,
        field: "academic_year",
      },
      term: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      amountPaidUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: "amount_paid_ugx",
      },
      paymentMethod: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "payment_method",
      },
      paidBy: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "paid_by",
      },
      receiptId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "receipt_id",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
      changeReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "change_reason",
      },
      allocatesPriorTerms: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "allocates_prior_terms",
      },
      note: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: "note",
      },
      paymentDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "payment_date",
      },
    },
    {
      sequelize,
      tableName: "student_fee_payments",
      modelName: "StudentFeePayment",
      timestamps: false,
      indexes: [
        { fields: ["created_at"] },
        { fields: ["student_id", "academic_year", "term"] },
      ],
    },
  );

  DailyExpenseEntry.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      expenseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "expense_date",
      },
      category: {
        type: DataTypes.STRING(80),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      amountUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: "amount_ugx",
      },
      paymentMethod: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "payment_method",
      },
      recordedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "recorded_by_user_id",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
      changeReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "change_reason",
      },
    },
    {
      sequelize,
      tableName: "daily_expense_entries",
      modelName: "DailyExpenseEntry",
      timestamps: false,
      indexes: [
        { fields: ["expense_date"] },
      ],
    },
  );

  DailyFinanceReport.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      reportDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "report_date",
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "not_submitted",
      },
      submittedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "submitted_by_user_id",
      },
      submittedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "submitted_at",
      },
      reviewedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "reviewed_by_user_id",
      },
      reviewedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "reviewed_at",
      },
      closedByUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "closed_by_user_id",
      },
      closedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: "closed_at",
      },
      reopenedReason: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "reopened_reason",
      },
      reopenedForUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "reopened_for_user_id",
      },
      isReopened: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: "is_reopened",
      },
      adminNotes: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: "admin_notes",
      },
    },
    {
      sequelize,
      tableName: "daily_finance_reports",
      modelName: "DailyFinanceReport",
      timestamps: false,
      indexes: [{ unique: true, fields: ["report_date"] }],
    },
  );

  DailyFinanceReportAudit.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      reportId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "report_id",
      },
      action: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      actorUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "actor_user_id",
      },
      note: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "daily_finance_report_audits",
      modelName: "DailyFinanceReportAudit",
      timestamps: false,
    },
  );

  StaffPayrollEntry.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      staffMemberId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: "staff_member_id",
      },
      monthKey: {
        type: DataTypes.STRING(7),
        allowNull: false,
        field: "month_key",
      },
      grossAmountUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        field: "gross_amount_ugx",
      },
      paidAmountUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        field: "paid_amount_ugx",
      },
      arrearsUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
        field: "arrears_ugx",
      },
      status: {
        type: DataTypes.STRING(24),
        allowNull: false,
        defaultValue: "pending",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "staff_payroll_entries",
      modelName: "StaffPayrollEntry",
      timestamps: false,
    },
  );

  // DB uses CONSTRAINT fk_students_classroom (schema.sql). Sequelize alter-sync
  // assumes default names like students_ibfk_1 and throws UnknownConstraintError
  // if they differ — so we keep the real FK in SQL and skip Sequelize FK DDL.
  Student.belongsTo(ClassRoom, {
    foreignKey: "class_room_id",
    as: "classRoom",
    constraints: false,
  });
  ClassRoom.hasMany(Student, {
    foreignKey: "class_room_id",
    as: "students",
    constraints: false,
  });
  ClassRoom.belongsTo(ClassCategory, {
    foreignKey: "category_id",
    as: "category",
    constraints: false,
  });
  ClassCategory.hasMany(ClassRoom, {
    foreignKey: "category_id",
    as: "classes",
    constraints: false,
  });
  ClassSection.belongsTo(ClassRoom, {
    foreignKey: "class_room_id",
    as: "classRoom",
    constraints: false,
  });
  ClassRoom.hasMany(ClassSection, {
    foreignKey: "class_room_id",
    as: "sections",
    constraints: false,
  });
  UserClassAuthorization.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
    constraints: false,
  });
  User.hasMany(UserClassAuthorization, {
    foreignKey: "user_id",
    as: "classAuthorizations",
    constraints: false,
  });
  UserClassAuthorization.belongsTo(ClassRoom, {
    foreignKey: "class_room_id",
    as: "classRoom",
    constraints: false,
  });
  ClassRoom.hasMany(UserClassAuthorization, {
    foreignKey: "class_room_id",
    as: "userAuthorizations",
    constraints: false,
  });

  PasswordResetOtp.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      emailLower: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "email_lower",
      },
      codeHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "code_hash",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "password_reset_otps",
      modelName: "PasswordResetOtp",
      timestamps: false,
    },
  );

  SecurityOtpChallenge.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "user_id",
      },
      purpose: { type: DataTypes.STRING(32), allowNull: false },
      codeHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "code_hash",
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "expires_at",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "security_otp_challenges",
      modelName: "SecurityOtpChallenge",
      timestamps: false,
    },
  );

  SecurityOtpChallenge.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
    constraints: false,
  });
  User.hasMany(SecurityOtpChallenge, {
    foreignKey: "user_id",
    as: "securityOtpChallenges",
    constraints: false,
  });

  UserNotification.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "user_id",
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      readAt: { type: DataTypes.DATE, field: "read_at", allowNull: true },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "user_notifications",
      modelName: "UserNotification",
      timestamps: false,
    },
  );

  UserMessage.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      recipientUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "recipient_user_id",
      },
      senderUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: "sender_user_id",
        allowNull: true,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      readAt: { type: DataTypes.DATE, field: "read_at", allowNull: true },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "user_messages",
      modelName: "UserMessage",
      timestamps: false,
    },
  );

  // FK names in db/schema.sql differ from Sequelize defaults; keep DDL in SQL only.
  UserNotification.belongsTo(User, {
    foreignKey: "user_id",
    as: "recipient",
    constraints: false,
  });
  User.hasMany(UserNotification, {
    foreignKey: "user_id",
    as: "notifications",
    constraints: false,
  });

  UserMessage.belongsTo(User, {
    foreignKey: "recipient_user_id",
    as: "recipient",
    constraints: false,
  });
  UserMessage.belongsTo(User, {
    foreignKey: "sender_user_id",
    as: "sender",
    constraints: false,
  });
  User.hasMany(UserMessage, {
    foreignKey: "recipient_user_id",
    as: "receivedMessages",
    constraints: false,
  });
  User.hasMany(UserMessage, {
    foreignKey: "sender_user_id",
    as: "sentMessages",
    constraints: false,
  });

  StaffMember.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: "user_id",
        allowNull: true,
      },
      staffType: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "teaching",
        field: "staff_type",
      },
      displayName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "display_name",
      },
      email: { type: DataTypes.STRING(255), allowNull: true },
      staffRole: {
        type: DataTypes.STRING(40),
        allowNull: false,
        field: "staff_role",
      },
      phone: { type: DataTypes.STRING(32), allowNull: true },
      address: { type: DataTypes.STRING(255), allowNull: true },
      gender: { type: DataTypes.STRING(20), allowNull: true },
      dateOfBirth: { type: DataTypes.STRING(20), allowNull: true, field: "date_of_birth" },
      nationality: { type: DataTypes.STRING(100), allowNull: true },
      maritalStatus: { type: DataTypes.STRING(40), allowNull: true, field: "marital_status" },
      nationalId: { type: DataTypes.STRING(60), allowNull: true, field: "national_id" },
      qualification: { type: DataTypes.STRING(120), allowNull: true },
      languages: { type: DataTypes.STRING(255), allowNull: true },
      dateOfJoining: { type: DataTypes.STRING(20), allowNull: true, field: "date_of_joining" },
      experience: { type: DataTypes.TEXT, allowNull: true },
      emergencyContactName: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: "emergency_contact_name",
      },
      emergencyContactPhone: {
        type: DataTypes.STRING(32),
        allowNull: true,
        field: "emergency_contact_phone",
      },
      refereeName: { type: DataTypes.STRING(120), allowNull: true, field: "referee_name" },
      refereeContact: { type: DataTypes.STRING(120), allowNull: true, field: "referee_contact" },
      staffPhotoUrl: { type: DataTypes.STRING(255), allowNull: true, field: "staff_photo_url" },
      staffPhotoName: { type: DataTypes.STRING(255), allowNull: true, field: "staff_photo_name" },
      assignedClass: { type: DataTypes.STRING(80), allowNull: true, field: "assigned_class" },
      teachingSection: { type: DataTypes.STRING(32), allowNull: true, field: "teaching_section" },
      staffCategory: { type: DataTypes.STRING(32), allowNull: true, field: "staff_category" },
      nationalIdPhotoUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "national_id_photo_url",
      },
      nationalIdPhotoName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: "national_id_photo_name",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "staff_members",
      modelName: "StaffMember",
      timestamps: false,
    },
  );

  Enquiry.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      subject: { type: DataTypes.STRING(255), allowNull: false },
      messageBody: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: "message_body",
      },
      sourceEmail: {
        type: DataTypes.STRING(255),
        field: "source_email",
        allowNull: true,
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "open",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "enquiries",
      modelName: "Enquiry",
      timestamps: false,
    },
  );

  NoticeBoardEntry.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      authorUserId: {
        type: DataTypes.INTEGER.UNSIGNED,
        field: "author_user_id",
        allowNull: true,
      },
      authorLabel: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "author_label",
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      body: { type: DataTypes.TEXT, allowNull: false },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: "general",
      },
      eventDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: "event_date",
      },
      publishedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "published_at",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "notice_board_entries",
      modelName: "NoticeBoardEntry",
      timestamps: false,
      indexes: [{ fields: ["published_at"] }],
    },
  );

  NoticeBoardComment.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      noticeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "notice_id",
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "user_id",
      },
      authorName: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "author_name",
      },
      body: { type: DataTypes.TEXT, allowNull: false },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "notice_board_comments",
      modelName: "NoticeBoardComment",
      timestamps: false,
    },
  );

  SchoolExpense.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      referenceCode: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: "reference_code",
      },
      expenseType: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "expense_type",
      },
      amountUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: "amount_ugx",
      },
      status: { type: DataTypes.STRING(20), allowNull: false },
      contactEmail: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: "contact_email",
      },
      expenseDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "expense_date",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "school_expenses",
      modelName: "SchoolExpense",
      timestamps: false,
      indexes: [{ fields: ["expense_date"] }],
    },
  );

  SchoolEvent.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      title: { type: DataTypes.STRING(255), allowNull: false },
      eventDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "event_date",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "school_events",
      modelName: "SchoolEvent",
      timestamps: false,
    },
  );

  DashboardChartPoint.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "sort_order",
      },
      xPos: { type: DataTypes.INTEGER, allowNull: false, field: "x_pos" },
      yPos: { type: DataTypes.INTEGER, allowNull: false, field: "y_pos" },
    },
    {
      sequelize,
      tableName: "dashboard_chart_points",
      modelName: "DashboardChartPoint",
      timestamps: false,
    },
  );

  SocialPlatformStat.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      platformKey: {
        type: DataTypes.STRING(32),
        allowNull: false,
        field: "platform_key",
      },
      displayLabel: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: "display_label",
      },
      followerCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        field: "follower_count",
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: "sort_order",
      },
    },
    {
      sequelize,
      tableName: "social_platform_stats",
      modelName: "SocialPlatformStat",
      timestamps: false,
    },
  );

  AttendanceRecord.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      studentId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "student_id",
      },
      recordDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: "record_date",
      },
      present: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "created_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "attendance_records",
      modelName: "AttendanceRecord",
      timestamps: false,
      indexes: [{ fields: ["record_date", "present"] }],
    },
  );

  DashboardKpi.init(
    {
      kpiKey: {
        type: DataTypes.STRING(64),
        primaryKey: true,
        field: "kpi_key",
      },
      valueText: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: "value_text",
      },
    },
    {
      sequelize,
      tableName: "dashboard_kpis",
      modelName: "DashboardKpi",
      timestamps: false,
    },
  );

  RolePermission.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      role: { type: DataTypes.STRING(50), allowNull: false },
      permissionKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: "permission_key",
      },
    },
    {
      sequelize,
      tableName: "role_permissions",
      modelName: "RolePermission",
      timestamps: false,
    },
  );

  UserPermissionOverride.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "user_id",
      },
      permissionKey: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: "permission_key",
      },
      allowed: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
    },
    {
      sequelize,
      tableName: "user_permission_overrides",
      modelName: "UserPermissionOverride",
      timestamps: false,
      indexes: [
        {
          name: "uq_user_permission_overrides_user_permission",
          unique: true,
          fields: ["user_id", "permission_key"],
        },
      ],
    },
  );

  SchoolSetting.init(
    {
      settingKey: {
        type: DataTypes.STRING(64),
        primaryKey: true,
        field: "setting_key",
      },
      settingValue: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: "setting_value",
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: "updated_at",
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: "school_settings",
      modelName: "SchoolSetting",
      timestamps: true,
      createdAt: false,
      updatedAt: "updated_at",
    },
  );

  Exam.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      examKey: { type: DataTypes.STRING(40), allowNull: false, field: "exam_key" },
      classRoomId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "class_room_id" },
      subject: { type: DataTypes.STRING(120), allowNull: false },
      examDate: { type: DataTypes.DATEONLY, allowNull: false, field: "exam_date" },
      createdAt: { type: DataTypes.DATE, field: "created_at", defaultValue: DataTypes.NOW },
    },
    { sequelize, tableName: "exams", modelName: "Exam", timestamps: false }
  );

  Exam.belongsTo(ClassRoom, { foreignKey: "class_room_id", as: "classRoom", constraints: false });
  ClassRoom.hasMany(Exam, { foreignKey: "class_room_id", as: "exams", constraints: false });

  StaffMember.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
    constraints: false,
  });
  User.hasMany(StaffMember, {
    foreignKey: "user_id",
    as: "staffMemberships",
    constraints: false,
  });

  NoticeBoardEntry.belongsTo(User, {
    foreignKey: "author_user_id",
    as: "authorUser",
    constraints: false,
  });
  User.hasMany(NoticeBoardEntry, {
    foreignKey: "author_user_id",
    as: "noticeAuthorships",
    constraints: false,
  });

  NoticeBoardComment.belongsTo(NoticeBoardEntry, {
    foreignKey: "notice_id",
    as: "notice",
    constraints: false,
  });
  NoticeBoardEntry.hasMany(NoticeBoardComment, {
    foreignKey: "notice_id",
    as: "comments",
    constraints: false,
  });
  NoticeBoardComment.belongsTo(User, {
    foreignKey: "user_id",
    as: "user",
    constraints: false,
  });
  User.hasMany(NoticeBoardComment, {
    foreignKey: "user_id",
    as: "noticeComments",
    constraints: false,
  });

  AttendanceRecord.belongsTo(Student, {
    foreignKey: "student_id",
    as: "student",
    constraints: false,
  });
  Student.hasMany(AttendanceRecord, {
    foreignKey: "student_id",
    as: "attendanceRecords",
    constraints: false,
  });

  StudentFeeReceipt.belongsTo(Student, {
    foreignKey: "student_id",
    as: "student",
    constraints: false,
  });
  Student.hasMany(StudentFeeReceipt, {
    foreignKey: "student_id",
    as: "feeReceipts",
    constraints: false,
  });
  StudentFeeAssignment.belongsTo(Student, {
    foreignKey: "student_id",
    as: "student",
    constraints: false,
  });
  Student.hasMany(StudentFeeAssignment, {
    foreignKey: "student_id",
    as: "feeAssignments",
    constraints: false,
  });
  StudentFeePayment.belongsTo(Student, {
    foreignKey: "student_id",
    as: "student",
    constraints: false,
  });
  Student.hasMany(StudentFeePayment, {
    foreignKey: "student_id",
    as: "feePayments",
    constraints: false,
  });
  StudentFeePayment.belongsTo(StudentFeeReceipt, {
    foreignKey: "receipt_id",
    as: "receipt",
    constraints: false,
  });
  StudentFeeReceipt.hasMany(StudentFeePayment, {
    foreignKey: "receipt_id",
    as: "payments",
    constraints: false,
  });
  StudentAssessmentResult.belongsTo(Student, {
    foreignKey: "student_id",
    as: "student",
    constraints: false,
  });
  Student.hasMany(StudentAssessmentResult, {
    foreignKey: "student_id",
    as: "assessmentResults",
    constraints: false,
  });
  StudentAssessmentResult.belongsTo(ClassRoom, {
    foreignKey: "class_room_id",
    as: "classRoom",
    constraints: false,
  });
  ClassRoom.hasMany(StudentAssessmentResult, {
    foreignKey: "class_room_id",
    as: "assessmentResults",
    constraints: false,
  });
  StudentAssessmentResult.belongsTo(User, {
    foreignKey: "entered_by_user_id",
    as: "enteredBy",
    constraints: false,
  });
  User.hasMany(StudentAssessmentResult, {
    foreignKey: "entered_by_user_id",
    as: "enteredAssessmentResults",
    constraints: false,
  });
  AcademicSubjectAssignment.belongsTo(ClassCategory, {
    foreignKey: "class_category_id",
    as: "classCategory",
    constraints: false,
  });
  ClassCategory.hasMany(AcademicSubjectAssignment, {
    foreignKey: "class_category_id",
    as: "subjectAssignments",
    constraints: false,
  });
  DailyFinanceReportAudit.belongsTo(DailyFinanceReport, {
    foreignKey: "report_id",
    as: "report",
    constraints: false,
  });
  DailyFinanceReport.hasMany(DailyFinanceReportAudit, {
    foreignKey: "report_id",
    as: "auditTrail",
    constraints: false,
  });
  DailyFinanceReport.belongsTo(User, {
    foreignKey: "submittedByUserId",
    as: "submittedBy",
    constraints: false,
  });
  DailyFinanceReport.belongsTo(User, {
    foreignKey: "reviewedByUserId",
    as: "reviewedBy",
    constraints: false,
  });
  DailyFinanceReport.belongsTo(User, {
    foreignKey: "closedByUserId",
    as: "closedBy",
    constraints: false,
  });
  DailyFinanceReport.belongsTo(User, {
    foreignKey: "reopenedForUserId",
    as: "reopenedFor",
    constraints: false,
  });
  DailyExpenseEntry.belongsTo(User, {
    foreignKey: "recorded_by_user_id",
    as: "recordedBy",
    constraints: false,
  });
  User.hasMany(DailyExpenseEntry, {
    foreignKey: "recorded_by_user_id",
    as: "expenseEntries",
    constraints: false,
  });
  StaffPayrollEntry.belongsTo(StaffMember, {
    foreignKey: "staff_member_id",
    as: "staffMember",
    constraints: false,
  });
  StaffMember.hasMany(StaffPayrollEntry, {
    foreignKey: "staff_member_id",
    as: "payrollEntries",
    constraints: false,
  });

  initFeeConfigModels(sequelize);
  associateFeeConfigModels(Student);

  return sequelize;
}

/** Case-insensitive email match (same idea as SQL LOWER(email) = LOWER(?)). */
export function userByEmailCi(normalized: string) {
  return User.findOne({
    where: where(fn("LOWER", col("email")), fn("LOWER", normalized)),
  });
}
