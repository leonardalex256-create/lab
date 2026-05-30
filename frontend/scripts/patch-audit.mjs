import fs from "fs";

const p = "src/components/settings/SettingsAuditLogPanel.tsx";
let s = fs.readFileSync(p, "utf8");

s = s.replace(
  'import { useState, useEffect, useCallback, useRef } from "react";',
  'import { Fragment, useState, useEffect, useRef } from "react";\nimport { PanelHeader, LoadingSpinner } from "./shared";',
);

s = s.replace(
  /  const load = useCallback\(async \(p = 1\) => \{[\s\S]*?  \}, \[filters\]\);\n\n  useEffect\(\(\) => \{\n    if \(debounceRef\.current\) window\.clearTimeout\(debounceRef\.current\);\n    debounceRef\.current = window\.setTimeout\(\(\) => \{ void load\(1\); setPage\(1\); \}, 400\);\n  \}, \[load\]\);/,
  `  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      let cancelled = false;
      const run = async (p = 1) => {
        setLoading(true);
        const params = new URLSearchParams({ page: String(p), limit: "50" });
        for (const [k, v] of Object.entries(filters)) {
          if (v) params.set(k, v);
        }
        try {
          const res = await fetch(apiUrl(\`/api/me/settings/audit-log?\${params}\`), { headers: authHeaders() });
          const json = await res.json();
          if (!cancelled && json.success) {
            setRows(json.data ?? []);
            setMeta(json.meta ?? { page: 1, limit: 50, total: 0, pages: 1 });
            if (json.filters?.actions?.length) {
              setAvailableActions((json.filters.actions as Array<{ action: string }>).map((a) => a.action));
            }
          }
        } catch {
          /* ignore */
        }
        if (!cancelled) setLoading(false);
      };
      void run(1);
      setPage(1);
      return () => {
        cancelled = true;
      };
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [filters]);`,
);

s = s.replace(
  /      <motionToast className="flex items-center justify-between">[\s\S]*?        <button className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">\n          Export Excel\n        <\/button>\n      <\/div>/,
  `      <PanelHeader
        icon={<span aria-hidden>📋</span>}
        title="Audit Log"
        description={\`All system activity — \${meta.total.toLocaleString()} events\`}
        action={
          <button
            type="button"
            disabled
            title="Export coming soon"
            className="cursor-not-allowed rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-400 shadow-sm opacity-60"
          >
            Export Excel
          </button>
        }
      />`,
);

s = s.replace(
  /      <div className="flex items-center justify-between">\n        <div>\n          <h2 className="text-xl font-bold text-slate-800">Audit Log<\/h2>[\s\S]*?        <\/button>\n      <\/motionToast>/,
  "",
);

s = s.replace(/<motionToast/g, "<div").replace(/<\/motionToast>/g, "");

s = s.replace(
  /      \{loading \? \(\n        <div className="space-y-2">\{\[\.\.\.Array\(8\)\]\.map\(\(_, i\) => <div key=\{i\} className="h-14 bg-slate-100 rounded-xl animate-pulse" \/>\)\}<\/div>\n      \) : \(/,
  "      {loading ? (\n        <LoadingSpinner label=\"Loading audit log\" />\n      ) : (",
);

s = s.replace(
  /                \{(\["Timestamp"[\s\S]*?)\.map\(\(h\) => \(\n                  <th key=\{h\} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">\{h\}<\/th>\n                \)\)\}/,
  `$1.map((h) => (
                  <th key={h} scope="col" className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">{h}</th>
                ))}`,
);

s = s.replace(
  /              \{rows\.map\(\(row\) => \(\n                <>\n                  <tr key=\{row\.id\}/,
  `              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr`,
);

s = s.replace(
  /                  \{expanded\.has\(row\.id\) && \(\n                    <tr key=\{\`\$\{row\.id\}-detail\`\}/,
  "                  {expanded.has(row.id) ? (\n                    <tr",
);

s = s.replace(/\n                <\/>\n              \)\)\}/, "\n                </Fragment>\n              ))}");

s = s.replace(
  /onClick=\{\(\) => \{ setPage\(page - 1\); void load\(page - 1\); \}\}/,
  "onClick={() => { const np = page - 1; setPage(np); /* page change triggers filter effect */ }}",
);

// Fix pagination - need load function for page changes. Add separate effect for page
if (!s.includes("void loadPage")) {
  s = s.replace(
    "  }, [filters]);",
    `  }, [filters]);

  useEffect(() => {
    if (page === 1) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      for (const [k, v] of Object.entries(filters)) {
        if (v) params.set(k, v);
      }
      try {
        const res = await fetch(apiUrl(\`/api/me/settings/audit-log?\${params}\`), { headers: authHeaders() });
        const json = await res.json();
        if (!cancelled && json.success) {
          setRows(json.data ?? []);
          setMeta(json.meta ?? { page: 1, limit: 50, total: 0, pages: 1 });
        }
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [page]);`,
  );
}

s = s.replace(
  /onClick=\{\(\) => \{ const np = page - 1; setPage\(np\); \/\* page change triggers filter effect \*\/ \}\}/,
  "onClick={() => setPage((p) => Math.max(1, p - 1))}",
);
s = s.replace(
  /onClick=\{\(\) => \{ setPage\(page \+ 1\); void load\(page \+ 1\); \}\}/,
  "onClick={() => setPage((p) => p + 1)}",
);

fs.writeFileSync(p, s);
console.log("audit patched");
