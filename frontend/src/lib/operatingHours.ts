import type { OperatingHours } from "../types";

export const defaultOperatingHours: OperatingHours = {
  enabled: false,
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  start: "07:00",
  end: "22:00",
};

const weekdayMap: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function minutes(value: string, fallback: number) {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || ""));
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return fallback;
  return hour * 60 + minute;
}

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone || "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return {
    weekday: weekdayMap[get("weekday")] ?? date.getDay(),
    minuteOfDay: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

export function normalizeOperatingHours(value?: Partial<OperatingHours> | null): OperatingHours {
  const weekdays = Array.isArray(value?.weekdays)
    ? value.weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : defaultOperatingHours.weekdays;
  return {
    enabled: Boolean(value?.enabled),
    weekdays: weekdays.length ? Array.from(new Set(weekdays)).sort((a, b) => a - b) : defaultOperatingHours.weekdays,
    start: /^\d{1,2}:\d{2}/.test(String(value?.start || "")) ? String(value!.start).slice(0, 5) : defaultOperatingHours.start,
    end: /^\d{1,2}:\d{2}/.test(String(value?.end || "")) ? String(value!.end).slice(0, 5) : defaultOperatingHours.end,
  };
}

export function isWithinOperatingHours(
  raw: Partial<OperatingHours> | null | undefined,
  timeZone: string,
  now = new Date(),
) {
  const config = normalizeOperatingHours(raw);
  if (!config.enabled) return true;
  const { weekday, minuteOfDay } = localParts(now, timeZone);
  const start = minutes(config.start, 0);
  const end = minutes(config.end, 23 * 60 + 59);

  if (start === end) return config.weekdays.includes(weekday);
  if (start < end) return config.weekdays.includes(weekday) && minuteOfDay >= start && minuteOfDay < end;
  if (minuteOfDay >= start) return config.weekdays.includes(weekday);
  const previousDay = (weekday + 6) % 7;
  return minuteOfDay < end && config.weekdays.includes(previousDay);
}

export function operatingHoursSummary(raw?: Partial<OperatingHours> | null) {
  const value = normalizeOperatingHours(raw);
  if (!value.enabled) return "Sempre ligada";
  const weekdays = value.weekdays;
  const days = weekdays.length === 7
    ? "Todos os dias"
    : weekdays.join(",") === "1,2,3,4,5"
      ? "Seg a Sex"
      : weekdays.map((day) => ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][day]).join(", ");
  return `${days} · ${value.start} → ${value.end}`;
}
