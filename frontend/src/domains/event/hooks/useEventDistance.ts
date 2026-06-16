import { useCallback, useMemo } from "react";

import useDataStore from "../../../shared/store/dataStore";
import type { Event } from "../types/event";
import {
  getDistanceInKilometers,
  hasEventCoordinates,
  type GeoPoint,
} from "../utils/event";
import useUserLocation from "./useUserLocation";

export default function useEventDistance() {
  const organizations = useDataStore((s) => s.organizations);
  const { position: userPosition } = useUserLocation();
  const activeOrganizationsById = useMemo(
    () =>
      new Map(
        organizations
          .filter((organization) => organization.is_active && !organization.deleted_at)
          .map((organization) => [organization.id, organization]),
      ),
    [organizations],
  );

  const getEventCoordinates = useCallback(
    (event: Event): GeoPoint | null => {
      if (hasEventCoordinates(event)) {
        return {
          latitude: event.latitude,
          longitude: event.longitude,
        };
      }

      const organization = activeOrganizationsById.get(event.organization_id);

      if (organization?.latitude == null || organization.longitude == null) {
        return null;
      }

      return {
        latitude: organization.latitude,
        longitude: organization.longitude,
      };
    },
    [activeOrganizationsById],
  );

  const getEventDistance = useCallback(
    (event: Event) => {
      if (!userPosition) return null;

      const eventCoordinates = getEventCoordinates(event);

      return eventCoordinates
        ? getDistanceInKilometers(userPosition, eventCoordinates)
        : null;
    },
    [getEventCoordinates, userPosition],
  );

  return { getEventCoordinates, getEventDistance, userPosition };
}
