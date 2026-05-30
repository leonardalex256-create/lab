export function StudentStatusBadge({
  code,
  name,
  colorHex,
}: {
  code: string | null;
  name: string | null;
  colorHex?: string | null;
}) {
  if (!code && !name) return <span className="text-slate-400 text-sm">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: `${colorHex ?? "#f59e0b"}22`,
        color: colorHex ?? "#b45309",
        border: `1px solid ${colorHex ?? "#f59e0b"}55`,
      }}
    >
      <span className="font-mono">{code}</span>
      {name ? <span>{name}</span> : null}
    </span>
  );
}
