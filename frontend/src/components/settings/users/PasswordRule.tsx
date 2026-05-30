export type PasswordRuleProps = {
  ok: boolean;
  label: string;
};

export function PasswordRule({ ok, label }: PasswordRuleProps) {
  return (
    <p
      className={`rounded-lg px-3 py-2 text-xs font-bold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}
    >
      {ok ? "OK" : "Need"} - {label}
    </p>
  );
}
