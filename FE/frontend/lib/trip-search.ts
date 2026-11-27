const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatDepartureDate(time: Date | string): string {
  return dateFormatter.format(new Date(time));
}

// Ngày đi tính theo giờ Việt Nam, kể cả khi server chạy ở múi giờ khác.
export function getDepartureDayRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const start = new Date(`${date}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime()) || formatDepartureDate(start) !== date) return null;
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { gte: start, lt: end };
}

export function formatVietnamDateTime(time: Date | string): string {
  const date = new Date(time);
  // datetime-local không có múi giờ: chuyển sang giờ Việt Nam trước khi hiển thị.
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export function parseVietnamDateTime(value: Date | string): Date {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    if (!getDepartureDayRange(value.slice(0, 10)) || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59) return new Date(NaN);
  }
  return value instanceof Date ? value : new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value);
}

export function getVietnamMonthStart(time: Date, offset = 0): Date {
  const [year, month] = formatDepartureDate(time).split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + offset, 1));
  return new Date(first.getTime() - 7 * 60 * 60 * 1000);
}
