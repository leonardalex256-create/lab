import fs from "fs";

const p = "src/components/settings/SettingsAuditLogPanel.tsx";
let s = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");

const start = s.indexOf('      <div className="flex items-center justify-between">');
const end = s.indexOf("      {/* Filters */}");
if (start === -1 || end === -1) {
  console.error("markers not found", start, end);
  process.exit(1);
}

const panelHeader = `      <PanelHeader
        icon={<span aria-hidden>📋</span>}
        title="Audit Log"
        description={\`All system activity — \${meta.total.toLocaleString()} events\`}
        action={
          <button
            type="button"
            disabled
            title="Export coming soon"
            className="cursor-not-allowed rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 opacity-60 shadow-sm"
          >
            Export Excel
          </button>
        }
      />

`;

s = s.slice(0, start) + panelHeader + s.slice(end);

s = s.replace(
  /      \{loading \? \(\n        <div className="space-y-2">[\s\S]*?\) : \(/,
  `      {loading ? (
        <LoadingSpinner label="Loading audit log" />
      ) : (`,
);

s = s.replace(
  /                  <th key=\{h\} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">/g,
  `<th key={h} scope="col" className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">`,
);

s = s.replace(
  `              {rows.map((row) => (
                <>
                  <tr key={row.id}`,
  `              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr`,
);

s = s.replace(
  `                  {expanded.has(row.id) && (
                    <tr key={\`\${row.id}-detail\`}`,
  `                  {expanded.has(row.id) ? (
                    <tr`,
);

s = s.replace(
  `                </>
              ))}`,
  `                </Fragment>
              ))}`,
);

s = s.replace(
  `onClick={() => { setPage(page - 1); void load(page - 1); }}`,
  `onClick={() => setPage((p) => Math.max(1, p - 1))}`,
);
s = s.replace(
  `onClick={() => { setPage(page + 1); void load(page + 1); }}`,
  `onClick={() => setPage((p) => p + 1)}`,
);

fs.writeFileSync(p, s);
console.log("ok", s.includes("PanelHeader"), s.includes("Fragment"));
