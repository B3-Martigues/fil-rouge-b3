import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import {
  staffApi,
  type StaffActionPayload,
  type StaffDataScope,
  type StaffDataSet,
} from "../api/staff.api";
import useDataStore from "../../../shared/store/dataStore";

const canUseStaffApi = (role?: string | null) =>
  role === "admin" || role === "moderator";

export default function useStaffSync(scope: StaffDataScope = "moderator-dashboard") {
  const currentUser = useAuthStore((state) => state.currentUser);
  const clearStaffData = useDataStore((state) => state.clearStaffData);
  const hydrateStaffData = useDataStore((state) => state.hydrateStaffData);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hydrate = useCallback(
    (data: StaffDataSet) => {
      hydrateStaffData(data);
    },
    [hydrateStaffData],
  );

  const refresh = useCallback(async () => {
    if (!canUseStaffApi(currentUser?.role)) {
      clearStaffData();
      setIsLoaded(false);
      setError(null);
      return false;
    }

    clearStaffData();
    setError(null);
    setIsLoaded(false);
    setIsLoading(true);
    const result = await staffApi.loadData(scope);
    setIsLoading(false);

    if (result.ok) {
      hydrate(result.data);
      setIsLoaded(true);
      return true;
    }

    clearStaffData();
    setError(result.error.message);
    if (result.error.code !== "unauthorized" && result.error.code !== "forbidden") {
      toast.error(result.error.message);
    }
    return false;
  }, [clearStaffData, currentUser?.role, hydrate, scope]);

  const applyAction = useCallback(
    async (payload: StaffActionPayload) => {
      if (!canUseStaffApi(currentUser?.role)) return false;

      const result = await staffApi.applyAction(payload);
      if (result.ok) {
        return refresh();
      }

      setError(result.error.message);
      toast.error(result.error.message);
      return false;
    },
    [currentUser?.role, refresh],
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
