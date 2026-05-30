export type UserRoleOption = {
  id:
    | "admin"
    | "accountant"
    | "head_teacher"
    | "teacher"
    | "registrar"
    | "staff"
    | "student"
    | "parent";
  label: string;
  description: string;
};

export const ROLE_OPTIONS: UserRoleOption[] = [
  {
    id: "admin",
    label: "admin",
    description: "Full school control and top-level system administration.",
  },
  {
    id: "accountant",
    label: "accountant",
    description: "Handles finance, payments, expenses, payroll, and bursary workflows.",
  },
  {
    id: "head_teacher",
    label: "head_teacher",
    description: "Oversees academic activity, teaching performance, and school learning records.",
  },
  {
    id: "teacher",
    label: "teacher",
    description: "Manages assigned classes, attendance, marks, and learner records.",
  },
  {
    id: "registrar",
    label: "registrar",
    description: "Manages admissions, student profiles, and parent-linked records.",
  },
  {
    id: "staff",
    label: "staff",
    description: "General internal access for approved non-teaching staff operations.",
  },
  {
    id: "student",
    label: "student",
    description: "Own-profile access for learner dashboards and school self-service.",
  },
  {
    id: "parent",
    label: "parent",
    description: "Parent/guardian access for linked children, fees, and communication.",
  },
];

export const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Roles that receive curriculum/class-scoped access via user_class_authorizations */
export const ROLES_WITH_CLASS_ASSIGNMENT = new Set(["teacher", "head_teacher"]);
