export function InstructionBlock({
  title = "What to do",
  steps,
}: {
  title?: string;
  steps: string[];
}) {
  return (
    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/80 px-5 py-4">
      <p className="text-xs font-bold uppercase tracking-wider text-indigo-800">{title}</p>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-indigo-950">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </div>
  );
}
