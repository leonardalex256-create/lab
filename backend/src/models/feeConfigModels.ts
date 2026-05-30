import { DataTypes, Model, type ModelStatic, type Sequelize } from "sequelize";

export class StudentStatus extends Model {
  declare id: number;
  declare name: string;
  declare code: string;
  declare description: string | null;
  declare colorHex: string;
  declare sortOrder: number;
  declare archivedAt: Date | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export class FeeCategory extends Model {
  declare id: number;
  declare name: string;
  declare code: string;
  declare billingFrequency: "term" | "monthly" | "annual" | "once" | "custom";
  declare isMandatory: boolean;
  declare description: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export class FeeCategoryStatus extends Model {
  declare id: number;
  declare feeCategoryId: number;
  declare studentStatusId: number;
}

export class FeeRule extends Model {
  declare id: number;
  declare name: string;
  declare feeCategoryId: number;
  declare studentStatusId: number;
  declare baseAmountUgx: number;
  declare plainEnglishText: string | null;
  declare formulaText: string | null;
  declare inputMode: "plain" | "formula";
  declare priority: number;
  declare effectiveFrom: string | null;
  declare effectiveTo: string | null;
  declare notes: string | null;
  declare isActive: boolean;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export class StudentFeeLineItem extends Model {
  declare id: number;
  declare studentId: number;
  declare term: string;
  declare academicYear: string;
  declare feeCategoryId: number;
  declare feeRuleId: number | null;
  declare amountUgx: number;
  declare notes: string | null;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

export function initFeeConfigModels(sequelize: Sequelize): void {
  StudentStatus.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      description: { type: DataTypes.TEXT, allowNull: true },
      colorHex: { type: DataTypes.STRING(7), allowNull: false, defaultValue: "#f59e0b", field: "color_hex" },
      sortOrder: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 0, field: "sort_order" },
      archivedAt: { type: DataTypes.DATE, allowNull: true, field: "archived_at" },
    },
    {
      sequelize,
      tableName: "student_statuses",
      modelName: "StudentStatus",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  FeeCategory.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      code: { type: DataTypes.STRING(20), allowNull: false, unique: true },
      billingFrequency: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: "term",
        field: "billing_frequency",
      },
      isMandatory: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: "is_mandatory",
      },
      description: { type: DataTypes.TEXT, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
    },
    {
      sequelize,
      tableName: "fee_categories",
      modelName: "FeeCategory",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  );

  FeeCategoryStatus.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      feeCategoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "fee_category_id",
      },
      studentStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "student_status_id",
      },
    },
    {
      sequelize,
      tableName: "fee_category_statuses",
      modelName: "FeeCategoryStatus",
      underscored: true,
      timestamps: false,
      indexes: [
        {
          name: "uq_fee_category_statuses",
          unique: true,
          fields: ["fee_category_id", "student_status_id"],
        },
      ],
    },
  );

  FeeRule.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(120), allowNull: false },
      feeCategoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "fee_category_id",
      },
      studentStatusId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "student_status_id",
      },
      baseAmountUgx: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: "base_amount_ugx",
      },
      plainEnglishText: { type: DataTypes.TEXT, allowNull: true, field: "plain_english_text" },
      formulaText: { type: DataTypes.TEXT, allowNull: true, field: "formula_text" },
      inputMode: {
        type: DataTypes.STRING(16),
        allowNull: false,
        defaultValue: "formula",
        field: "input_mode",
      },
      priority: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 100 },
      effectiveFrom: { type: DataTypes.DATEONLY, allowNull: true, field: "effective_from" },
      effectiveTo: { type: DataTypes.DATEONLY, allowNull: true, field: "effective_to" },
      notes: { type: DataTypes.STRING(255), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: "is_active" },
    },
    {
      sequelize,
      tableName: "fee_rules",
      modelName: "FeeRule",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "idx_fee_rules_status_category",
          fields: ["student_status_id", "fee_category_id", "priority"],
        },
      ],
    },
  );

  StudentFeeLineItem.init(
    {
      id: { type: DataTypes.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
      studentId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, field: "student_id" },
      term: { type: DataTypes.STRING(20), allowNull: false },
      academicYear: { type: DataTypes.STRING(4), allowNull: false, field: "academic_year" },
      feeCategoryId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: "fee_category_id",
      },
      feeRuleId: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true, field: "fee_rule_id" },
      amountUgx: { type: DataTypes.BIGINT, allowNull: false, field: "amount_ugx" },
      notes: { type: DataTypes.STRING(255), allowNull: true },
    },
    {
      sequelize,
      tableName: "student_fee_line_items",
      modelName: "StudentFeeLineItem",
      underscored: true,
      timestamps: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
      indexes: [
        {
          name: "uq_student_fee_line_items",
          unique: true,
          fields: ["student_id", "academic_year", "term", "fee_category_id"],
        },
      ],
    },
  );
}

export function associateFeeConfigModels(StudentModel: ModelStatic<Model>): void {
  StudentStatus.hasMany(StudentModel, {
    foreignKey: "student_status_id",
    as: "students",
    constraints: false,
  });
  StudentModel.belongsTo(StudentStatus, {
    foreignKey: "student_status_id",
    as: "studentStatus",
    constraints: false,
  });

  FeeCategory.belongsToMany(StudentStatus, {
    through: FeeCategoryStatus,
    foreignKey: "fee_category_id",
    otherKey: "student_status_id",
    as: "applicableStatuses",
    constraints: false,
  });
  StudentStatus.belongsToMany(FeeCategory, {
    through: FeeCategoryStatus,
    foreignKey: "student_status_id",
    otherKey: "fee_category_id",
    as: "feeCategories",
    constraints: false,
  });

  FeeRule.belongsTo(FeeCategory, { foreignKey: "fee_category_id", as: "feeCategory", constraints: false });
  FeeRule.belongsTo(StudentStatus, { foreignKey: "student_status_id", as: "studentStatus", constraints: false });
  FeeCategory.hasMany(FeeRule, { foreignKey: "fee_category_id", as: "rules", constraints: false });
  StudentStatus.hasMany(FeeRule, { foreignKey: "student_status_id", as: "feeRules", constraints: false });

  StudentFeeLineItem.belongsTo(StudentModel, {
    foreignKey: "student_id",
    as: "student",
    constraints: false,
  });
  StudentModel.hasMany(StudentFeeLineItem, {
    foreignKey: "student_id",
    as: "feeLineItems",
    constraints: false,
  });
  StudentFeeLineItem.belongsTo(FeeCategory, {
    foreignKey: "fee_category_id",
    as: "feeCategory",
    constraints: false,
  });
  StudentFeeLineItem.belongsTo(FeeRule, { foreignKey: "fee_rule_id", as: "feeRule", constraints: false });
}
