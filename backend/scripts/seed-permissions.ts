import "./loadBackendEnv.js";
import { loadConfig } from "../src/config.js";
import { setupDatabase, RolePermission } from "../src/models/index.js";

async function main() {
  const config = loadConfig();
  const sequelize = setupDatabase(config);
  await sequelize.authenticate();

  const defaults = [
    // Accountant
    { role: "accountant", permissionKey: "nav_dashboard" },
    { role: "accountant", permissionKey: "nav_operations" },
    { role: "accountant", permissionKey: "nav_communication" },
    { role: "accountant", permissionKey: "nav_settings" },

    // DOS
    { role: "dos", permissionKey: "nav_dashboard" },
    { role: "dos", permissionKey: "nav_students" },
    { role: "dos", permissionKey: "nav_classes" },
    { role: "dos", permissionKey: "nav_staff" },
    { role: "dos", permissionKey: "nav_curriculum" },
    { role: "dos", permissionKey: "nav_communication" },

    // Head Teacher
    { role: "head_teacher", permissionKey: "nav_dashboard" },
    { role: "head_teacher", permissionKey: "nav_students" },
    { role: "head_teacher", permissionKey: "nav_classes" },
    { role: "head_teacher", permissionKey: "nav_staff" },
    { role: "head_teacher", permissionKey: "nav_curriculum" },
    { role: "head_teacher", permissionKey: "nav_communication" },
    { role: "head_teacher", permissionKey: "nav_settings" },
  ];

  for (const row of defaults) {
    await RolePermission.findOrCreate({
      where: { role: row.role, permissionKey: row.permissionKey },
      defaults: row,
    });
  }

  console.log("Default permissions seeded successfully.");
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
