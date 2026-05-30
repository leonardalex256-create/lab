import type { ManagedUser } from "../../../api/account";
import type { ClassRoomOption } from "../../../api/students";

export type ClassAssignModalProps = {
  user: ManagedUser;
  classrooms: ClassRoomOption[];
  classRoomSelection: number[];
  saving: boolean;
  onToggleClassRoom: (classRoomId: number) => void;
  onClose: () => void;
  onSave: () => void;
};

export function ClassAssignModal({
  user,
  classrooms,
  classRoomSelection,
  saving,
  onToggleClassRoom,
  onClose,
  onSave,
}: ClassAssignModalProps) {
  const activeRooms = classrooms.filter((c) => c.isActive !== false);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="class-assign-title"
      onClick={() => {
        if (!saving) onClose();
      }}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-slate-50 px-6 py-4">
          <h2 id="class-assign-title" className="text-lg font-black text-[#0c2340]">
            Class assignment
          </h2>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Choose which classes <span className="font-bold text-slate-700">{user.name}</span> can access
            for curriculum and class-scoped tools.
          </p>
        </div>
        <div className="max-h-[min(52vh,420px)] overflow-y-auto px-6 py-4">
          {activeRooms.length === 0 ? (
            <p className="text-sm font-medium text-slate-500">
              No active classes in the system. Add classes under Settings → Class structure first.
            </p>
          ) : (
            <ul className="space-y-2">
              {[...activeRooms]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((room) => {
                  const checked = classRoomSelection.includes(room.id);
                  return (
                    <li key={room.id}>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 transition-colors hover:bg-indigo-50/60">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                          checked={checked}
                          disabled={saving}
                          onChange={() => onToggleClassRoom(room.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-800">{room.name}</span>
                          {room.categoryName ? (
                            <span className="mt-0.5 block text-xs font-medium text-slate-500">
                              {room.categoryName}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
        <div className="flex gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || activeRooms.length === 0}
            onClick={onSave}
            className="flex-1 rounded-xl bg-gradient-to-r from-[#0c2340] to-[#1a3a5c] py-3 text-sm font-bold text-white shadow-lg shadow-[#0c2340]/25 transition-all hover:shadow-xl disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
