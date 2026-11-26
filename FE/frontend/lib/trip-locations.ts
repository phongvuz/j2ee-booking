export const DEFAULT_TRIP_LOCATIONS = [
  "Hồ Chí Minh", "Đà Lạt", "Huế", "Nha Trang", "Hà Nội", "Đà Nẵng", "Vũng Tàu", "Cần Thơ",
] as const;

// Keep database labels verbatim: changing an existing route's spelling can be
// rejected when that trip already has tickets.
export function mergeTripLocations(...groups: ReadonlyArray<readonly string[]>): string[] {
  return [...new Set([...DEFAULT_TRIP_LOCATIONS, ...groups.flat()].filter((value) => value.trim()))]
    .sort((left, right) => left.localeCompare(right, "vi"));
}

export function sameTripLocation(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase("vi") === right.trim().toLocaleLowerCase("vi");
}
