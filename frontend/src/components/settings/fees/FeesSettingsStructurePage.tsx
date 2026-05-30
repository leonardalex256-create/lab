import { useCallback, useEffect, useRef, useState } from "react";
import { fetchFeeCategoriesExist } from "../../../api/feeCategories";
import { fetchStudentStatusCount } from "../../../api/studentStatuses";
import { StudentStatusesStep } from "./steps/StudentStatusesStep";
import { FeeCategoriesStep } from "./steps/FeeCategoriesStep";
import { FeeRulesStep } from "./steps/FeeRulesStep";
import { InstructionBlock } from "./shared/InstructionBlock";
import { scrollPageToElement } from "./shared/scrollToTop";
import { btnPrimary, btnSecondary } from "./shared/fieldStyles";
import "../../../styles/fee-config-theme.css";

const STEPS = [
  { id: 1, title: "Student statuses", short: "Statuses" },
  { id: 2, title: "Fee categories", short: "Categories" },
  { id: 3, title: "Fee rules", short: "Rules" },
] as const;

export type FeesSetupStep = 1 | 2 | 3;

export function FeesSettingsStructurePage({
  initialStep = 1,
  onSetupProgressChange,
}: {
  initialStep?: FeesSetupStep;
  onSetupProgressChange?: () => void;
}) {
  const [step, setStep] = useState<FeesSetupStep>(initialStep);
  const [statusCount, setStatusCount] = useState(0);
  const [categoriesExist, setCategoriesExist] = useState(false);
  const [loading, setLoading] = useState(true);
  const topRef = useRef<HTMLDivElement>(null);

  const scrollToTop = useCallback(() => {
    scrollPageToElement(topRef.current, "smooth");
  }, []);

  const refreshProgress = useCallback(async () => {
    try {
      const [sc, ce] = await Promise.all([
        fetchStudentStatusCount(),
        fetchFeeCategoriesExist(),
      ]);
      setStatusCount(sc);
      setCategoriesExist(ce);
      onSetupProgressChange?.();
    } catch {
      setStatusCount(0);
      setCategoriesExist(false);
    } finally {
      setLoading(false);
    }
  }, [onSetupProgressChange]);

  useEffect(() => {
    setStep(initialStep);
    const id = requestAnimationFrame(() => scrollToTop());
    return () => cancelAnimationFrame(id);
  }, [initialStep, scrollToTop]);

  useEffect(() => {
    void refreshProgress();
  }, [refreshProgress]);

  function canEnterStep(target: FeesSetupStep): boolean {
    if (target === 1) return true;
    if (target === 2) return statusCount >= 1;
    if (target === 3) return statusCount >= 1 && categoriesExist;
    return false;
  }

  function goToStep(target: FeesSetupStep) {
    if (!canEnterStep(target)) return;
    setStep(target);
    requestAnimationFrame(() => scrollToTop());
  }

  function goNext() {
    if (step < 3) goToStep((step + 1) as FeesSetupStep);
  }

  function goBack() {
    if (step > 1) goToStep((step - 1) as FeesSetupStep);
  }

  const nextDisabled =
    (step === 1 && statusCount < 1) || (step === 2 && !categoriesExist);

  const currentStepMeta = STEPS.find((s) => s.id === step);

  return (
    <div className="fee-config-theme mx-auto max-w-6xl space-y-6 pb-28">
      <div ref={topRef} className="scroll-mt-4" aria-hidden="true" />

      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-blue-900 px-8 py-10 shadow-xl sm:px-12">
        <div className="relative z-10">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Fees Settings &amp; Structure
          </h2>
          <p className="mt-3 max-w-3xl text-base text-indigo-200">
            Configure how fees are calculated for each student. This replaces the old boarding-based
            fee structure. New admissions and assign-fees use these rules automatically.
          </p>
        </div>
      </div>

      <div className="sticky top-0 z-30 -mx-1 space-y-4 rounded-2xl border border-slate-200/80 bg-[#f8f6f1]/95 px-3 py-3 shadow-sm backdrop-blur-md sm:-mx-2 sm:px-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Fees setup steps">
          {STEPS.map((s) => {
            const enabled = canEnterStep(s.id);
            const active = step === s.id;
            const done =
              (s.id === 1 && statusCount >= 1) ||
              (s.id === 2 && categoriesExist) ||
              (s.id === 3 && categoriesExist);
            return (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-disabled={!enabled && !active}
                disabled={!enabled && !active}
                onClick={() => goToStep(s.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                  active
                    ? "bg-indigo-600 text-white shadow-md"
                    : done
                      ? "bg-emerald-100 text-emerald-800"
                      : enabled
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : "bg-slate-50 text-slate-400 cursor-not-allowed"
                }`}
              >
                {s.id}. {s.short}
                {done && !active ? " ✓" : ""}
              </button>
            );
          })}
        </div>
        <p className="text-sm font-semibold text-slate-700">
          Step {step} of {STEPS.length}: {currentStepMeta?.title}
        </p>
      </div>

      <InstructionBlock
        title="Setup order"
        steps={[
          "Define student statuses configured for your school (used on profiles and fee rules).",
          "Add fee categories (Tuition, Meals, etc.) and link them to statuses.",
          "Create fee rules with amounts or formulas for each status + category pair.",
        ]}
      />

      {!loading && step === 2 && statusCount < 1 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Complete step 1 first — add at least one student status.
        </p>
      ) : null}
      {!loading && step === 3 && !categoriesExist ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Complete step 2 first — add at least one fee category.
        </p>
      ) : null}

      <div key={step} className="space-y-6">
        {step === 1 ? (
          <StudentStatusesStep
            onDataChange={() => void refreshProgress()}
            statusCount={statusCount}
          />
        ) : null}
        {step === 2 ? (
          <FeeCategoriesStep onDataChange={() => void refreshProgress()} />
        ) : null}
        {step === 3 ? (
          <FeeRulesStep
            onDataChange={() => void refreshProgress()}
            onSubStepChange={() => requestAnimationFrame(() => scrollToTop())}
          />
        ) : null}
      </div>

      <div className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/60 bg-white/95 px-6 py-5 shadow-lg backdrop-blur-xl">
        <div>
          {step > 1 ? (
            <button type="button" className={btnSecondary} onClick={goBack}>
              Back
            </button>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {step < 3 ? (
            <button
              type="button"
              className={btnPrimary}
              disabled={nextDisabled}
              onClick={goNext}
              title={
                nextDisabled
                  ? step === 1
                    ? "Add at least one student status"
                    : "Add at least one fee category"
                  : undefined
              }
            >
              Continue to step {step + 1}
            </button>
          ) : (
            <p className="self-center text-sm font-medium text-slate-600">
              Setup complete — you can return to any step to edit saved data.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
