export function localDateTimeToUtcDate(
  dateStr: string, // e.g. "2026-11-27"
  timeStr: string, // e.g. "18:55"
  timeZone: string // e.g. "Europe/Amsterdam", "Asia/Kolkata"
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(utcGuess);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value || 0);

  const zonedAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second")
  );

  const intendedUtcWall = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMs = zonedAsUtc - intendedUtcWall;

  return new Date(intendedUtcWall - offsetMs);
}
