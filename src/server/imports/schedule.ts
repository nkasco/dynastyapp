type DailyCron = {
  minute: number;
  hour: number;
};

function partsFor(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  const hour = value("hour");

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: hour === 24 ? 0 : hour,
    minute: value("minute"),
    second: value("second"),
  };
}

function zonedTimeToUtcDate(input: { year: number; month: number; day: number; hour: number; minute: number }, timeZone: string) {
  const utcGuess = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0);
  const actual = partsFor(new Date(utcGuess), timeZone);
  const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  const wantedAsUtc = Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute, 0);

  return new Date(utcGuess + (wantedAsUtc - actualAsUtc));
}

function addLocalDay(parts: { year: number; month: number; day: number }) {
  const next = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1, 12, 0, 0));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

export function parseDailyCron(cron: string): DailyCron {
  const [minute, hour, dayOfMonth, month, dayOfWeek] = cron.trim().split(/\s+/);

  if (dayOfMonth !== "*" || month !== "*" || dayOfWeek !== "*") {
    throw new Error("IMPORT_NIGHTLY_CRON must be a daily cron like '0 1 * * *'.");
  }

  const parsed = {
    minute: Number(minute),
    hour: Number(hour),
  };

  if (!Number.isInteger(parsed.minute) || parsed.minute < 0 || parsed.minute > 59) {
    throw new Error("IMPORT_NIGHTLY_CRON minute must be between 0 and 59.");
  }

  if (!Number.isInteger(parsed.hour) || parsed.hour < 0 || parsed.hour > 23) {
    throw new Error("IMPORT_NIGHTLY_CRON hour must be between 0 and 23.");
  }

  return parsed;
}

export function getNextNightlyRunAt(input: { now?: Date; timeZone: string; cron: string }) {
  const now = input.now ?? new Date();
  const cron = parseDailyCron(input.cron);
  const localNow = partsFor(now, input.timeZone);
  const todayRunAt = zonedTimeToUtcDate({ ...localNow, hour: cron.hour, minute: cron.minute }, input.timeZone);

  if (todayRunAt.getTime() > now.getTime()) {
    return todayRunAt;
  }

  const tomorrow = addLocalDay(localNow);
  return zonedTimeToUtcDate({ ...tomorrow, hour: cron.hour, minute: cron.minute }, input.timeZone);
}
