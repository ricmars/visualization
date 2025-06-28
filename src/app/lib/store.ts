import { create } from "zustand";
import { Case } from "../types";

interface WorkflowStore {
  cases: Case[] | undefined;
  loading: boolean;
  isCreateModalOpen: boolean;
  isCreatingWorkflow: boolean;
  setCases: (cases: Case[]) => void;
  setLoading: (loading: boolean) => void;
  setCreateModalOpen: (isOpen: boolean) => void;
  setCreatingWorkflow: (isCreating: boolean) => void;
  addCase: (newCase: Case) => void;
  removeCase: (name: string) => void;
}

type WorkflowState = Pick<
  WorkflowStore,
  "cases" | "loading" | "isCreateModalOpen" | "isCreatingWorkflow"
>;

export const useWorkflowStore = create<WorkflowStore>(
  (set: (fn: (state: WorkflowState) => Partial<WorkflowState>) => void) => ({
    cases: undefined,
    loading: true,
    isCreateModalOpen: false,
    isCreatingWorkflow: false,
    setCases: (cases: Case[]) => set(() => ({ cases })),
    setLoading: (loading: boolean) => set(() => ({ loading })),
    setCreateModalOpen: (isOpen: boolean) =>
      set(() => ({ isCreateModalOpen: isOpen })),
    setCreatingWorkflow: (isCreating: boolean) =>
      set(() => ({ isCreatingWorkflow: isCreating })),
    addCase: (newCase: Case) =>
      set((state: WorkflowState) => ({
        cases: state.cases ? [...state.cases, newCase] : [newCase],
      })),
    removeCase: (name: string) =>
      set((state: WorkflowState) => ({
        cases: state.cases?.filter((c) => c.name !== name) || [],
      })),
  }),
);
