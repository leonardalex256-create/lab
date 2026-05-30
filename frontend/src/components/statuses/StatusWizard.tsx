import { useState } from "react";

import {

  createStudentStatus,

  fetchStudentStatusCount,

} from "../../api/studentStatuses";

import { StatusForm } from "./StatusForm";

import "../../styles/fee-config-theme.css";



export function StatusWizard({

  onComplete,

  onOpenFeesSettings,

}: {

  onComplete: () => void;

  onOpenFeesSettings?: () => void;

}) {

  const [step, setStep] = useState(1);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);



  return (

    <div className="fee-config-theme fixed inset-0 z-50 flex items-center justify-center bg-[#0f1b35]/90 p-4">

      <div className="fee-panel max-w-lg w-full bg-white shadow-xl">

        <p className="text-sm text-slate-500 mb-1">Step {step} of 3</p>

        <h1 className="text-2xl font-bold mb-2">Set up Student Statuses</h1>

        <p className="text-slate-600 mb-6">

          Before registering students or assigning fees, define how students are grouped for fee rules in

          Fees Settings &amp; Structure.

        </p>



        {step === 1 ? (

          <>

            <p className="mb-4">Choose how to get started:</p>

            <div className="flex flex-col gap-2">

              {onOpenFeesSettings ? (

                <button type="button" className="fee-btn-primary" onClick={onOpenFeesSettings}>

                  Open Fees Settings &amp; Structure

                </button>

              ) : null}

              <button

                type="button"

                className="rounded border px-4 py-2"

                onClick={() => {

                  setShowForm(true);

                  setStep(2);

                }}

              >

                Add your first status here

              </button>

            </div>

          </>

        ) : null}



        {step === 2 && showForm ? (

          <StatusForm

            onCancel={() => {

              setShowForm(false);

              setStep(1);

            }}

            onSubmit={async (v) => {

              setBusy(true);

              setError(null);

              try {

                await createStudentStatus(v);

                const count = await fetchStudentStatusCount();

                if (count > 0) setStep(3);

              } catch (e) {

                setError(e instanceof Error ? e.message : "Failed");

              } finally {

                setBusy(false);

              }

            }}

          />

        ) : null}



        {step === 3 ? (

          <>

            <p className="text-green-700 mb-4">Student statuses are ready.</p>

            <div className="flex flex-col gap-2">

              {onOpenFeesSettings ? (

                <button type="button" className="fee-btn-primary" onClick={onOpenFeesSettings}>

                  Open Fees Settings &amp; Structure

                </button>

              ) : null}

              <button

                type="button"

                className={onOpenFeesSettings ? "rounded border px-4 py-2" : "fee-btn-primary"}

                onClick={onComplete}

              >

                Continue to the app

              </button>

            </div>

          </>

        ) : null}



        {error ? <p className="mt-4 text-red-600 text-sm">{error}</p> : null}

      </div>

    </div>

  );

}

