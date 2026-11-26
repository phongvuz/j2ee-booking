export function normalizeSeat(value: string): string {
  const match = value.trim().toUpperCase().match(/^(?:[12])?([ABC])0?([1-9]\d?)$/);
  return match ? `${match[1]}${match[2].padStart(2, "0")}` : value.trim().toUpperCase();
}

// Số thứ tự tăng theo A01, B01, C01, A02... và dừng ở sức chứa của chuyến.
export function getSeatCodes(capacity: number): string[] {
  return Array.from({ length: capacity }, (_, index) => {
    const row = ["A", "B", "C"][index % 3];
    const number = Math.floor(index / 3) + 1;
    return `${row}${String(number).padStart(2, "0")}`;
  });
}
