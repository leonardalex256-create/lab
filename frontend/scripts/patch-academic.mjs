import fs from "fs";

const p = "src/components/settings/SettingsAcademicPanel.tsx";
let s = fs.readFileSync(p, "utf8");

s = s.replace(
  /  if \(loading\) \{[\s\S]*?  \}\n\n  return \(/,
  `  if (loading) {
    return <LoadingSpinner label="Loading Academic Settings" />;
  }

  function discardChanges() {
    if (originalThresholdsRef.current) {
      setLocalThresholds(JSON.parse(originalThresholdsRef.current) as GradingThreshold[]);
      setDirty(false);
    }
  }

  return (`,
);

s = s.replace(
  /      <header className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">[\s\S]*?      <\/header>\n\n      <section>/,
  `      <PanelHeader
        gradient
        icon={<span aria-hidden>🎓</span>}
        title="Academic Settings"
        description="Configure grading scales, thresholds, and academic policies."
        action={
          <button
            type="button"
            onClick={addRule}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300"
            title="Define a new grading threshold rule"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add New Rule
          </button>
        }
      />

      <section>`,
);

s = s.replace(
  /      <motionToast className=\{`fixed bottom-8[\s\S]*?\) : null\}\n    <\/section>/,
  `      <UnsavedBar
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onDiscard={discardChanges}
        label="Unsaved grading changes"
        saveLabel="Save System"
      />

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </section>`,
);

// fallback if motionToast not in file
s = s.replace(
  /      <div className=\{`fixed bottom-8[\s\S]*?\) : null\}\n    <\/section>/,
  `      <UnsavedBar
        dirty={dirty}
        saving={saving}
        onSave={() => void onSave()}
        onDiscard={discardChanges}
        label="Unsaved grading changes"
        saveLabel="Save System"
      />

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}
    </section>`,
);

fs.writeFileSync(p, s);
console.log("patched");
