import fs from "fs";

const p = "src/components/settings/SettingsUsersRolesPanel.tsx";
let s = fs.readFileSync(p, "utf8");

// 1. Move USERS_PAGE_SIZE to module level
s = s.replace(
  "export function SettingsUsersRolesPanel() {",
  "const USERS_PAGE_SIZE = 100;\n\nexport function SettingsUsersRolesPanel() {",
);
// Remove the inline declaration inside the function
s = s.replace(/\n  const USERS_PAGE_SIZE = 100;\n/, "\n");

// 2. Fix err: any catches
const fixes = [
  [
    `} catch (err: any) {\n      setStatus("Error saving permissions: " + err.message);`,
    `} catch (err: unknown) {\n      setStatus("Error saving permissions: " + (err instanceof Error ? err.message : String(err)));`,
  ],
  [
    `} catch (err: any) {\n      setStatus(err?.message ?? "Failed to create user");`,
    `} catch (err: unknown) {\n      setStatus(err instanceof Error ? err.message : "Failed to create user");`,
  ],
  [
    `} catch (err: any) {\n      setStatus(err?.message ?? "Failed to update user status");`,
    `} catch (err: unknown) {\n      setStatus(err instanceof Error ? err.message : "Failed to update user status");`,
  ],
  [
    `} catch (err: any) {\n      setStatus(err?.message ?? "Failed to delete user");`,
    `} catch (err: unknown) {\n      setStatus(err instanceof Error ? err.message : "Failed to delete user");`,
  ],
  [
    `} catch (err: any) {\n      setStatus(err?.message ?? "Failed to reset password");`,
    `} catch (err: unknown) {\n      setStatus(err instanceof Error ? err.message : "Failed to reset password");`,
  ],
];

for (const [from, to] of fixes) {
  if (s.includes(from)) {
    s = s.replaceAll(from, to);
  } else {
    console.warn("not found:", from.slice(0, 60));
  }
}

// 3. Import ConfirmModal from shared
if (!s.includes('from "./shared"')) {
  s = s.replace(
    `import {\n  groupAvailableKeysBySector,`,
    `import { ConfirmModal } from "./shared";\nimport {\n  groupAvailableKeysBySector,`,
  );
}

const remaining = (s.match(/err: any/g) ?? []).length;
console.log("remaining err:any", remaining);
fs.writeFileSync(p, s);
console.log("done");
