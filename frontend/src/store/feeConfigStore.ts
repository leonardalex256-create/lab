import { create } from "zustand";
import { fetchStudentStatuses, type StudentStatusRow } from "../api/studentStatuses";
import { fetchFeeCategories, type FeeCategoryRow } from "../api/feeCategories";
import { fetchFeeRules, type FeeRuleRow } from "../api/feeRules";

type FeeConfigState = {
  statuses: StudentStatusRow[];
  categories: FeeCategoryRow[];
  rules: FeeRuleRow[];
  loading: boolean;
  loadStatuses: () => Promise<void>;
  loadCategories: (statusId?: number) => Promise<void>;
  loadRules: (filters?: { studentStatusId?: number; feeCategoryId?: number }) => Promise<void>;
};

export const useFeeConfigStore = create<FeeConfigState>((set) => ({
  statuses: [],
  categories: [],
  rules: [],
  loading: false,
  loadStatuses: async () => {
    set({ loading: true });
    try {
      const statuses = await fetchStudentStatuses();
      set({ statuses });
    } finally {
      set({ loading: false });
    }
  },
  loadCategories: async (statusId) => {
    set({ loading: true });
    try {
      const categories = await fetchFeeCategories(statusId);
      set({ categories });
    } finally {
      set({ loading: false });
    }
  },
  loadRules: async (filters) => {
    set({ loading: true });
    try {
      const rules = await fetchFeeRules(filters);
      set({ rules });
    } finally {
      set({ loading: false });
    }
  },
}));
