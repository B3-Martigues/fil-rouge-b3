import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, useMap, ZoomControl } from "react-leaflet";

import EventMarker from "./EventMarker";
import UserLocationMarker from "./UserLocationMarker";
import type { UserPosition } from "../hooks/useUserLocation";
import MapFitBounds from "./MapFitBounds";
import { getDistanceInKilometers, hasEventCoordinates } from "../utils/event";
import type { Event } from "../types/event";

type EventMapProps = {
  events: Event[];
  isInitialDataReady?: boolean;
  isUserLocationReady?: boolean;
  selectedEventId?: number | null;
  selectedEventRequestId?: number;
  userPosition?: UserPosition | null;
  showPopups?: boolean;
  onEventSelect?: (eventId: number) => void;
  onEventImageError?: (eventId: number) => void;
};

type MappableEvent = Event & { latitude: number; longitude: number };

type SelectedEventFocusProps = {
  event: MappableEvent | null;
  requestId: number;
  onFocusStart: () => void;
  onFocusDone: (eventId: number) => void;
};

const SELECTED_EVENT_ZOOM = 16;
const HOME_MAP_READY_EVENT = "mappening:home-map-ready";
const DESKTOP_MEDIA_QUERY = "(min-width: 761px)";
const MOBILE_SHEET_SELECTOR = ".events-list";
const LOCATION_PRECISION = 6;
const INITIAL_NEARBY_EVENTS_COUNT = 5;
const INITIAL_NEARBY_FIT_MAX_ZOOM = 12;
const INITIAL_NEARBY_FIT_PADDING: [number, number] = [56, 56];
const PROGRESSIVE_EVENT_BATCH_DELAY_MS = 120;
const PROGRESSIVE_EVENT_BATCH_SIZE = 12;

const getDesktopSidebarRightEdge = (mapContainer: HTMLElement) => {
  if (!window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return 0;

  const sidebar = document.querySelector<HTMLElement>(".events-list");
  const sidebarRect = sidebar?.getBoundingClientRect();
  const mapRect = mapContainer.getBoundingClientRect();

  if (!sidebarRect || sidebarRect.width <= 0) return 0;

  const sidebarRightInMap = Math.max(
    sidebarRect.right - mapRect.left,
    sidebarRect.width,
  );

  return Math.max(0, Math.min(mapRect.width, sidebarRightInMap));
};

const getMobileBottomSheetTop = (
  mapContainer: HTMLElement,
  mapHeight: number,
) => {
  if (window.matchMedia(DESKTOP_MEDIA_QUERY).matches) return mapHeight;

  const sheet = document.querySelector<HTMLElement>(MOBILE_SHEET_SELECTOR);
  const mapRect = mapContainer.getBoundingClientRect();

  if (!sheet) return mapHeight;

  const sheetRect = sheet.getBoundingClientRect();

  if (!sheetRect || sheetRect.width <= 0 || sheetRect.height <= 0) {
    return mapHeight;
  }

  const overlapsMapHorizontally =
    sheetRect.left < mapRect.right && sheetRect.right > mapRect.left;

  if (!overlapsMapHorizontally) return mapHeight;

  const currentVisibleHeight = Math.max(
    0,
    mapRect.bottom - Math.max(mapRect.top, sheetRect.top),
  );
  const isOpenSheet =
    sheet.classList.contains("events-list--expanded") ||
    sheet.classList.contains("events-list--detail");
  const finalVisibleHeight = isOpenSheet
    ? Math.min(sheetRect.height, mapHeight)
    : currentVisibleHeight;
  const sheetVisibleHeight = Math.max(currentVisibleHeight, finalVisibleHeight);

  return Math.max(0, mapHeight - sheetVisibleHeight);
};

const getOffsetFocusCenter = (
  map: ReturnType<typeof useMap>,
  event: MappableEvent,
  zoom: number,
) => {
  const mapSize = map.getSize();
  const mapContainer = map.getContainer();
  const visibleLeft = getDesktopSidebarRightEdge(mapContainer);
  const visibleBottom = getMobileBottomSheetTop(mapContainer, mapSize.y);

  if (
    visibleLeft <= 0 &&
    visibleBottom >= mapSize.y
  ) {
    return [event.latitude, event.longitude] as [number, number];
  }

  const desiredMarkerX = visibleLeft + (mapSize.x - visibleLeft) / 2;
  const desiredMarkerY = visibleBottom / 2;
  const centerX = mapSize.x / 2;
  const centerY = mapSize.y / 2;
  const horizontalOffset = desiredMarkerX - centerX;
  const verticalOffset = desiredMarkerY - centerY;
  const eventPoint = map.project([event.latitude, event.longitude], zoom);
  const centerPoint = eventPoint.subtract([horizontalOffset, verticalOffset]);

  return map.unproject(centerPoint, zoom);
};

const getLocationKey = (event: MappableEvent) =>
  `${event.latitude.toFixed(LOCATION_PRECISION)}:${event.longitude.toFixed(
    LOCATION_PRECISION,
  )}`;

const getTemporalDistance = (event: Event, now: number) => {
  const startTime = new Date(event.start_date).getTime();

  return Number.isNaN(startTime) ? Number.POSITIVE_INFINITY : Math.abs(startTime - now);
};

const isCloserToNow = (
  candidate: MappableEvent,
  current: MappableEvent,
  now: number,
) => {
  const candidateDistance = getTemporalDistance(candidate, now);
  const currentDistance = getTemporalDistance(current, now);

  if (candidateDistance !== currentDistance) {
    return candidateDistance < currentDistance;
  }

  return candidate.id < current.id;
};

const selectClosestEventsByLocation = (
  events: MappableEvent[],
  now: number,
  selectedEventId: number | null,
) => {
  const eventByLocation = new Map<string, MappableEvent>();

  events.forEach((event) => {
    const locationKey = getLocationKey(event);
    const currentEvent = eventByLocation.get(locationKey);

    if (currentEvent?.id === selectedEventId) {
      return;
    }

    if (
      event.id === selectedEventId ||
      (!currentEvent || isCloserToNow(event, currentEvent, now))
    ) {
      eventByLocation.set(locationKey, event);
    }
  });

  return Array.from(eventByLocation.values());
};

const selectNearestEventsToPoint = (
  events: MappableEvent[],
  point: UserPosition,
  count: number,
) =>
  events
    .map((event) => ({
      distance: getDistanceInKilometers(point, event),
      event,
    }))
    .sort((firstItem, secondItem) => {
      if (firstItem.distance !== secondItem.distance) {
        return firstItem.distance - secondItem.distance;
      }

      return firstItem.event.id - secondItem.event.id;
    })
    .slice(0, count)
    .map((item) => item.event);

const sortEventsByDistanceToPoint = (
  events: MappableEvent[],
  point: UserPosition,
) =>
  events
    .map((event) => ({
      distance: getDistanceInKilometers(point, event),
      event,
    }))
    .sort((firstItem, secondItem) => {
      if (firstItem.distance !== secondItem.distance) {
        return firstItem.distance - secondItem.distance;
      }

      return firstItem.event.id - secondItem.event.id;
    })
    .map((item) => item.event);

function SelectedEventFocus({
  event,
  requestId,
  onFocusStart,
  onFocusDone,
}: SelectedEventFocusProps) {
  const map = useMap();

  useEffect(() => {
    if (!event) return;

    let hasOpenedPopup = false;
    const openPopup = () => {
      if (hasOpenedPopup) return;

      hasOpenedPopup = true;
      onFocusDone(event.id);
    };

    onFocusStart();
    map.closePopup();
    const targetZoom = Math.max(map.getZoom(), SELECTED_EVENT_ZOOM);
    const targetCenter = getOffsetFocusCenter(map, event, targetZoom);

    map.flyTo(targetCenter, targetZoom, { animate: true, duration: 0.7 });
    map.once("moveend", openPopup);

    const fallbackId = window.setTimeout(openPopup, 900);

    return () => {
      map.off("moveend", openPopup);
      window.clearTimeout(fallbackId);
    };
  }, [event, map, onFocusDone, onFocusStart, requestId]);

  return null;
}

export default function EventMap({
  events,
  isInitialDataReady = true,
  isUserLocationReady = true,
  selectedEventId = null,
  selectedEventRequestId = 0,
  userPosition = null,
  showPopups = true,
  onEventSelect,
  onEventImageError,
}: EventMapProps) {
  const [openPopupEventId, setOpenPopupEventId] = useState<number | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [shouldFitInitialLocation, setShouldFitInitialLocation] = useState(false);
  const [hasCompletedUserLocationFit, setHasCompletedUserLocationFit] =
    useState(false);
  const [visibleEventCount, setVisibleEventCount] = useState(
    PROGRESSIVE_EVENT_BATCH_SIZE,
  );
  const [eventDeduplicationReferenceTime] = useState(() => Date.now());
  const hasAnnouncedReady = useRef(false);
  const hasFittedInitialLocation = useRef(false);
  const mappableEvents = useMemo(
    () => {
      const eventsWithCoordinates = events.filter(hasEventCoordinates);

      const closestEventsByLocation = selectClosestEventsByLocation(
        eventsWithCoordinates,
        eventDeduplicationReferenceTime,
        selectedEventId,
      );

      return userPosition
        ? sortEventsByDistanceToPoint(closestEventsByLocation, userPosition)
        : closestEventsByLocation;
    },
    [eventDeduplicationReferenceTime, events, selectedEventId, userPosition],
  );
  const selectedEvent = useMemo(
    () =>
      selectedEventId == null
        ? null
        : mappableEvents.find((event) => event.id === selectedEventId) ?? null,
    [mappableEvents, selectedEventId],
  );
  const mapPoints = useMemo(
    () => [
      ...mappableEvents.map((event) => ({
        latitude: event.latitude,
        longitude: event.longitude,
      })),
      ...(userPosition ? [userPosition] : []),
    ],
    [mappableEvents, userPosition],
  );
  const initialFitPoints = useMemo(() => {
    if (!userPosition) return mapPoints;

    const nearestEvents = selectNearestEventsToPoint(
      mappableEvents,
      userPosition,
      INITIAL_NEARBY_EVENTS_COUNT,
    );

    return [
      userPosition,
      ...nearestEvents.map((event) => ({
        latitude: event.latitude,
        longitude: event.longitude,
      })),
    ];
  }, [mappableEvents, mapPoints, userPosition]);
  const visibleMappableEvents = useMemo(() => {
    if (!userPosition) return mappableEvents;

    const visibleEvents = mappableEvents.slice(0, visibleEventCount);

    if (
      selectedEvent &&
      !visibleEvents.some((event) => event.id === selectedEvent.id)
    ) {
      return [...visibleEvents, selectedEvent];
    }

    return visibleEvents;
  }, [mappableEvents, selectedEvent, userPosition, visibleEventCount]);
  const handleFocusStart = useCallback(() => {
    setOpenPopupEventId(null);
  }, []);
  const handleFocusDone = useCallback((eventId: number) => {
    setOpenPopupEventId(eventId);
  }, []);
  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
  }, []);
  const handleInitialFitDone = useCallback(() => {
    setShouldFitInitialLocation(false);
    setHasCompletedUserLocationFit(true);
  }, []);

  useEffect(() => {
    if (!isUserLocationReady || !userPosition || hasFittedInitialLocation.current) {
      return;
    }

    hasFittedInitialLocation.current = true;
    const fitTimer = window.setTimeout(() => {
      setShouldFitInitialLocation(true);
    }, 0);

    return () => {
      window.clearTimeout(fitTimer);
    };
  }, [isUserLocationReady, userPosition]);

  useEffect(() => {
    if (!userPosition) {
      setVisibleEventCount(mappableEvents.length);
      return;
    }

    setVisibleEventCount(
      Math.min(PROGRESSIVE_EVENT_BATCH_SIZE, mappableEvents.length),
    );

    if (mappableEvents.length <= PROGRESSIVE_EVENT_BATCH_SIZE) {
      return;
    }

    let timeoutId: number | undefined;
    const revealNextBatch = () => {
      setVisibleEventCount((currentCount) => {
        const nextCount = Math.min(
          currentCount + PROGRESSIVE_EVENT_BATCH_SIZE,
          mappableEvents.length,
        );

        if (nextCount < mappableEvents.length) {
          timeoutId = window.setTimeout(
            revealNextBatch,
            PROGRESSIVE_EVENT_BATCH_DELAY_MS,
          );
        }

        return nextCount;
      });
    };

    timeoutId = window.setTimeout(
      revealNextBatch,
      PROGRESSIVE_EVENT_BATCH_DELAY_MS,
    );

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [mappableEvents, userPosition]);

  const hasCompletedInitialLocationFit =
    isUserLocationReady && (!userPosition || hasCompletedUserLocationFit);

  useEffect(() => {
    if (
      !isInitialDataReady ||
      !isUserLocationReady ||
      !hasCompletedInitialLocationFit ||
      !isMapReady ||
      hasAnnouncedReady.current
    ) {
      return;
    }

    const readyTimer = window.setTimeout(() => {
      hasAnnouncedReady.current = true;
      window.dispatchEvent(new Event(HOME_MAP_READY_EVENT));
    }, 350);

    return () => {
      window.clearTimeout(readyTimer);
    };
  }, [
    hasCompletedInitialLocationFit,
    isInitialDataReady,
    isMapReady,
    isUserLocationReady,
  ]);

  const activeOpenPopupEventId = selectedEvent ? openPopupEventId : null;

  return (
    <MapContainer
      center={[43.2965, 5.3698]}
      className="event-map"
      zoom={13}
      zoomControl={false}
      scrollWheelZoom={true}
      whenReady={handleMapReady}
    >
      <ZoomControl position="bottomright" />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapFitBounds
        enabled={shouldFitInitialLocation && selectedEventId == null}
        maxZoom={INITIAL_NEARBY_FIT_MAX_ZOOM}
        padding={INITIAL_NEARBY_FIT_PADDING}
        points={initialFitPoints}
        singlePointZoom={INITIAL_NEARBY_FIT_MAX_ZOOM}
        onFitDone={handleInitialFitDone}
      />
      <SelectedEventFocus
        event={selectedEvent}
        requestId={selectedEventRequestId}
        onFocusStart={handleFocusStart}
        onFocusDone={handleFocusDone}
      />
      {visibleMappableEvents.map((event) => (
        <EventMarker
          key={event.id}
          event={event}
          shouldOpenPopup={activeOpenPopupEventId === event.id}
          showPopup={showPopups}
          onSelect={onEventSelect}
          onImageError={onEventImageError}
        />
      ))}
      {userPosition && (
        <UserLocationMarker
          latitude={userPosition.latitude}
          longitude={userPosition.longitude}
        />
      )}
    </MapContainer>
  );
}
