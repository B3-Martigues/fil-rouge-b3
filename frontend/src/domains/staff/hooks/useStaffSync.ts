import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import { staffApi, type StaffActionPayload, type StaffSnapshot } from "../api/staff.api";
import useDataStore from "../../../shared/store/dataStore";

const canUseStaffApi = (role?: string | null) =>
  role === "admin" || role === "moderator";

export default function useStaffSync() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const clearStaffSnapshot = useDataStore((state) => state.clearStaffSnapshot);
  const hydrateStaffSnapshot = useDataStore((state) => state.hydrateStaffSnapshot);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(
    (snapshot: StaffSnapshot) => {
      hydrateStaffSnapshot(snapshot);
    },
    [hydrateStaffSnapshot],
  );

  const refresh = useCallback(async () => {
    if (!canUseStaffApi(currentUser?.role)) {
      clearStaffSnapshot();
      setIsLoaded(false);
      setError(null);
      return;
    }

    clearStaffSnapshot();
    setError(null);
    setIsLoaded(false);
    setIsLoading(true);
    const result = await staffApi.snapshot();
    setIsLoading(false);

    if (result.ok) {
      hydrate(result.data);
      setIsLoaded(true);
      return;
    }

    clearStaffSnapshot();
    setError(result.error.message);
    if (result.error.code !== "unauthorized" && result.error.code !== "forbidden") {
      toast.error(result.error.message);
    }
  }, [clearStaffSnapshot, currentUser?.role, hydrate]);

  const applyAction = useCallback(
    async (payload: StaffActionPayload) => {
      if (!canUseStaffApi(currentUser?.role)) return false;

      const result = await staffApi.applyAction(payload);
      if (result.ok) {
        hydrate(result.data);
        setIsLoaded(true);
        setError(null);
        return true;
      }

      setError(result.error.message);
      toast.error(result.error.message);
      return false;
    },
    [currentUser?.role, hydrate],
  );

  useEffect(() => {
    queueMicrotask(() => {
      void refresh();
    });
  }, [refresh]);

  return {
    applyAction,
    error,
    isLoaded,
    isLoading,
    refresh,
  };
}
