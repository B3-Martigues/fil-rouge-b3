import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

import useAuthStore from "../../auth/store/authStore";
import { staffApi, type StaffActionPayload, type StaffSnapshot } from "../api/staff.api";
import useDataStore from "../../../shared/store/dataStore";

const canUseStaffApi = (role?: string | null) =>
  role === "admin" || role === "moderator";

export default function useStaffSync() {
  const currentUser = useAuthStore((state) => state.currentUser);
  const hydrateStaffSnapshot = useDataStore((state) => state.hydrateStaffSnapshot);
  const [isLoading, setIsLoading] = useState(false);

  const hydrate = useCallback(
    (snapshot: StaffSnapshot) => {
      hydrateStaffSnapshot(snapshot);
    },
    [hydrateStaffSnapshot],
  );

  const refresh = useCallback(async () => {
    if (!canUseStaffApi(currentUser?.role)) return;

    setIsLoading(true);
    const result = await staffApi.snapshot();
    setIsLoading(false);

    if (result.ok) {
      hydrate(result.data);
      return;
    }

    if (result.error.code !== "unauthorized" && result.error.code !== "forbidden") {
      toast.error(result.error.message);
    }
  }, [currentUser?.role, hydrate]);

  const applyAction = useCallback(
    async (payload: StaffActionPayload) => {
      if (!canUseStaffApi(currentUser?.role)) return false;

      const result = await staffApi.applyAction(payload);
      if (result.ok) {
        hydrate(result.data);
        return true;
      }

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
    isLoading,
    refresh,
  };
}
