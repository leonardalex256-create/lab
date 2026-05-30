import fs from "fs";
import path from "path";

const file = path.join("src/components/settings/SettingsGeneralPanel.tsx");
let s = fs.readFileSync(file, "utf8");

s = s.replace(/\r?\ntype SettingsSectionProps[\s\S]*$/, "");

const sharedImport = `import {
  Toast,
  UnsavedBar,
  PanelHeader,
  SettingsSection,
  SettingsRow,
  LoadingSpinner,
} from "./shared";
`;

if (!s.includes('from "./shared"')) {
  s = s.replace(
    /import \{ fetchGeneralSettings/,
    `${sharedImport}import { fetchGeneralSettings`,
  );
}

s = s.replace(
  /<SettingsRow\s+label="([^"]+)"\s+description="([^"]*)"\s+control=\{\s*([\s\S]*?)\s*\}\s*\/>/g,
  (_m, label, description, inner) =>
    `<SettingsRow label="${label}" description="${description}">\n          ${inner.trim()}\n        </SettingsRow>`,
);

const requiredLabels = ["School Name", "Academic Year", "Currency Code", "Country"];
for (const label of requiredLabels) {
  s = s.replace(
    new RegExp(`<SettingsRow label="${label}" description="([^"]*)">`),
    `<SettingsRow label="${label}" description="$1" required>`,
  );
}

s = s.replace(
  /<SettingsSection title="Notifications">/,
  '<SettingsSection title="Security">',
);

s = s.replace(
  /if \(loading\) \{\s*return \(\s*<div className="flex min-h-\[40vh\][\s\S]*?\);\s*\}/,
  "if (loading) {\n    return <LoadingSpinner label=\"Loading Settings\" />;\n  }",
);

s = s.replace(
  /<header className="neo-card[\s\S]*?<\/header>/,
  `<PanelHeader
        gradient
        icon={<span aria-hidden>🏫</span>}
        title="General Settings"
        description="Configure school profile, preferences, access rules, and security policy."
      />`,
);

s = s.replace(
  /} catch \(err: any\) \{\s*setToast\(\{ message: err\.message \|\| "Failed to save settings\.", type: "error" \}\);/,
  `} catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save settings.";
      setToast({ message, type: "error" });`,
);

s = s.replace(
  /debugClientLog\(\{/g,
  "if (import.meta.env.DEV) debugClientLog({",
);

// Close the if block after debugClientLog call in load catch
s = s.replace(
  /(\s*\/\/ #endregion\n\s*setToast\(\{ message, type: "error" \}\);)/,
  "$1\n          }",
);

s = s.replace(
  /<div className="neo-card sticky bottom-6[\s\S]*?<\/div>\s*\n\s*\{toast \? \([\s\S]*?\) : null\}/,
  `<UnsavedBar
        dirty={dirty}
        saving={saving}
        onSave={onSave}
        onDiscard={discardChanges}
        saveLabel="Save Settings"
      />

      {toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      ) : null}`,
);

fs.writeFileSync(file, s);
console.log("done");
