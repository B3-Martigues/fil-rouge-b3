import type { Event } from "../types/event";

const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

const dateFormatOptions: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
};

const timeFormatOptions: Intl.DateTimeFormatOptions = {
  timeStyle: "short",
};

const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

export type EventStatus = "past" | "current" | "upcoming";
export type EventPeriodMode = "day" | "week" | "month" | "year";
export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export function isUpcomingEvent(endDate: string): boolean {
  return new Date(endDate) >= new Date();
}

export function getEventStatus(
  event: Pick<Event, "start_date" | "end_date">,
  referenceDate = new Date(),
): EventStatus {
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);

  if (endDate < referenceDate) return "past";
  if (startDate <= referenceDate) return "current";

  return "upcoming";
}

export function isEventInPeriod(
  event: Pick<Event, "start_date" | "end_date">,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  const startDate = new Date(event.start_date);
  const endDate = new Date(event.end_date);

  return startDate <= periodEnd && endDate >= periodStart;
}

export function toDateTimeLocalValue(date: string): string {
  return date.slice(0, 16);
}

export function hasEventCoordinates(
  event: Event,
): event is Event & { latitude: number; longitude: number } {
  return event.latitude != null && event.longitude != null;
}

export function getDistanceInKilometers(
  firstPoint: GeoPoint,
  secondPoint: GeoPoint,
): number {
  const earthRadiusInKilometers = 6371;
  const latitudeDelta = toRadians(secondPoint.latitude - firstPoint.latitude);
  const longitudeDelta = toRadians(secondPoint.longitude - firstPoint.longitude);
  const firstLatitude = toRadians(firstPoint.latitude);
  const secondLatitude = toRadians(secondPoint.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) *
      Math.cos(secondLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    earthRadiusInKilometers *
    2 *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function formatDistance(distanceInKilometers: number): string {
  if (distanceInKilometers < 1) {
    return `${Math.round(distanceInKilometers * 1000)} m`;
  }

  return `${distanceInKilometers.toFixed(distanceInKilometers < 10 ? 1 : 0)} km`;
}

export function formatEventPrice(price: number): string {
  return price > 0 ? priceFormatter.format(price) : "Gratuit";
}

export function getTicketingHref(ticketingLink: string): string | null {
  const value = ticketingLink.trim();
  if (!value || /\s/.test(value)) return null;

  if (URL.canParse(value)) return value;

  const valueWithProtocol = `https://${value}`;
  return URL.canParse(valueWithProtocol) ? valueWithProtocol : null;
}

export function isValidOptionalUrl(value: string): boolean {
  return value.trim() === "" || getTicketingHref(value) !== null;
}

export function isEventSuspended(
  event: Pick<Event, "suspended_until">,
  at = new Date(),
): boolean {
  if (!event.suspended_until) return false;

  return new Date(event.suspended_until).getTime() > at.getTime();
}

export function formatEventDateRange(
  event: Pick<Event, "start_date" | "end_date">,
): string {
  const start = new Date(event.start_date);
  const end = new Date(event.end_date);

  if (isSameLocalDay(start, end)) {
    return `${formatDate(start)} ${formatTime(start)} - ${formatTime(end)}`;
  }

  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("fr-FR", dateTimeFormatOptions);
}

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("fr-FR", dateFormatOptions);
}

function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString("fr-FR", timeFormatOptions);
}

function isSameLocalDay(firstDate: Date, secondDate: Date): boolean {
  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

export function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  const dayIndex = (weekStart.getDay() + 6) % 7;

  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - dayIndex);

  return weekStart;
}

export function getPeriodRange(
  mode: EventPeriodMode,
  value: string,
): { start: Date; end: Date } {
  if (mode === "day") {
    const start = new Date(value);
    const end = new Date(start);

    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() + 1);
    end.setHours(0, 0, 0, 0);
    end.setMilliseconds(-1);

    return { start, end };
  }

  if (mode === "week") {
    const weekStart = parseWeekInputValue(value);
    const weekEnd = new Date(weekStart);

    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setMilliseconds(-1);

    return { start: weekStart, end: weekEnd };
  }

  if (mode === "month") {
    const [year, month] = value.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    end.setMilliseconds(-1);

    return { start, end };
  }

  const year = Number(value);
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  end.setMilliseconds(-1);

  return { start, end };
}

export function getDefaultPeriodValue(mode: EventPeriodMode, date = new Date()) {
  if (mode === "day") return formatDayInputValue(date);
  if (mode === "week") return formatWeekInputValue(date);
  if (mode === "month") return formatMonthInputValue(date);

  return String(date.getFullYear());
}

function formatDayInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(date.getDate()).padStart(2, "0")}`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

export function formatWeekInputValue(date: Date): string {
  const currentDate = new Date(date);
  const dayIndex = (currentDate.getDay() + 6) % 7;

  currentDate.setHours(0, 0, 0, 0);
  currentDate.setDate(currentDate.getDate() + 3 - dayIndex);

  const weekYear = currentDate.getFullYear();
  const firstThursday = new Date(weekYear, 0, 4);
  const firstThursdayDayIndex = (firstThursday.getDay() + 6) % 7;

  firstThursday.setDate(firstThursday.getDate() + 3 - firstThursdayDayIndex);

  const weekNumber =
    1 +
    Math.round(
      (currentDate.getTime() - firstThursday.getTime()) /
        (7 * 24 * 60 * 60 * 1000),
    );

  return `${weekYear}-W${String(weekNumber).padStart(2, "0")}`;
}

export function parseWeekInputValue(value: string): Date {
  const [yearValue, weekValue] = value.split("-W");
  const year = Number(yearValue);
  const week = Number(weekValue);
  const fourthJanuary = new Date(year, 0, 4);
  const firstWeekStart = getWeekStart(fourthJanuary);

  firstWeekStart.setDate(firstWeekStart.getDate() + (week - 1) * 7);

  return firstWeekStart;
}

function formatMonthInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    "0",
  )}`;
}
