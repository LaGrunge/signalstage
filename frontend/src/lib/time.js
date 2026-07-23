const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

export function formatRelativeTime(dateInput) {
  const date = new Date(dateInput);
  const seconds = Math.max(0, (Date.now() - date.getTime()) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < HOUR) {
    const minutes = Math.round(seconds / MINUTE);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (seconds < DAY) {
    const hours = Math.round(seconds / HOUR);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (seconds < MONTH) {
    const days = Math.round(seconds / DAY);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  if (seconds < YEAR) {
    const months = Math.round(seconds / MONTH);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(seconds / YEAR);
  const months = Math.round((seconds - years * YEAR) / MONTH);
  const yearsPart = `${years} year${years === 1 ? "" : "s"}`;
  if (months === 0) return `${yearsPart} ago`;
  return `${yearsPart} ${months} month${months === 1 ? "" : "s"} ago`;
}
