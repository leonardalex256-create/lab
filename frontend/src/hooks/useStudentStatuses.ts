import { useCallback, useEffect, useState } from "react";
import { fetchStudentStatuses, type StudentStatusRow } from "../api/studentStatuses";

export function useStudentStatuses(includeArchived = false) {
  const [statuses, setStatuses] = useState<StudentStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchStudentStatuses(includeArchived);
      setStatuses(includeArchived ? rows : rows.filter((x) => !x.archivedAt));
    } catch (e) {
      setStatuses([]);
      setError(e instanceof Error ? e.message : "Failed to load statuses");
    } finally {
      setLoading(false);
    }
  }, [includeArchived]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { statuses, loading, error, reload };
}
