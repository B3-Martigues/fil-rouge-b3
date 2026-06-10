import type { Event } from "../types/event";

const dateTimeFormatOptions: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
};

export type EventStatus = "past" | "current" | "upcoming";
export type EventPeriodMode = "day" | "week" | "month" | "year";

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

  return `${formatDateTime(start)} - ${formatDateTime(end)}`;
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("fr-FR", dateTimeFormatOptions);
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
