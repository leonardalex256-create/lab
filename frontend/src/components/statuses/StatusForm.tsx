import { useState } from "react";

export function StatusForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: { name: string; code: string; description: string; colorHex: string };
  onSubmit: (v: { name: string; code: string; description: string; colorHex: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [code, setCode] = useState(initial?.code ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [colorHex, setColorHex] = useState(initial?.colorHex ?? "#f59e0b");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ name, code, description, colorHex });
      }}
    >
      <label className="block text-sm">
        Name
        <input
          className="mt-1 w-full rounded border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="block text-sm">
        Code
        <input
          className="mt-1 w-full rounded border px-3 py-2 font-mono uppercase"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          required
        />
      </label>
      <label className="block text-sm">
        Description
        <textarea
          className="mt-1 w-full rounded border px-3 py-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </label>
      <label className="block text-sm">
        Color
        <input
          type="color"
          className="mt-1 block h-10 w-20"
          value={colorHex}
          onChange={(e) => setColorHex(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <button type="submit" className="fee-btn-primary">
          Save
        </button>
        <button type="button" className="rounded border px-3 py-2" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
