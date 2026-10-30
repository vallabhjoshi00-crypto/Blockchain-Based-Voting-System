/**
 * ===============================================================================
 * INDIAN STANDARD TIME (IST - Asia/Kolkata, UTC+05:30) DATE & TIME UTILITIES
 * ===============================================================================
 */

/**
 * Returns formatted IST timestamp string: "YYYY-MM-DD HH:mm:ss IST"
 * Example: "2026-10-30 10:25:40 IST"
 */
export function getISTTimestamp(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString();

  const options = {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  };

  const parts = new Intl.DateTimeFormat("en-GB", options).formatToParts(d);
  const p = {};
  parts.forEach(({ type, value }) => {
    p[type] = value;
  });

  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second} IST`;
}

/**
 * Returns ISO-8601 string with explicit IST (+05:30) offset:
 * Example: "2026-10-30T10:25:40.123+05:30"
 */
export function getISTISO(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return new Date().toISOString();

  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffsetMs);
  return istDate.toISOString().replace("Z", "+05:30");
}

export default {
  getISTTimestamp,
  getISTISO
};

