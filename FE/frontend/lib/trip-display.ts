const STATION_NAMES: Record<string, string> = {
  SGN: "Hồ Chí Minh",
  HCM: "Hồ Chí Minh",
  TPHCM: "Hồ Chí Minh",
  "TP.HCM": "Hồ Chí Minh",
  "SÀI GÒN": "Hồ Chí Minh",
  "SAI GON": "Hồ Chí Minh",
  DLT: "Đà Lạt",
  "ĐÀ LẠT": "Đà Lạt",
  "DA LAT": "Đà Lạt",
  NHA: "Nha Trang",
  "NHA TRANG": "Nha Trang",
  HAN: "Hà Nội",
  "HÀ NỘI": "Hà Nội",
  "HA NOI": "Hà Nội",
  DAD: "Đà Nẵng",
  "ĐÀ NẴNG": "Đà Nẵng",
  "DA NANG": "Đà Nẵng",
  VT: "Vũng Tàu",
  "VŨNG TÀU": "Vũng Tàu",
  "VUNG TAU": "Vũng Tàu",
  CTH: "Cần Thơ",
  "CẦN THƠ": "Cần Thơ",
  "CAN THO": "Cần Thơ",
};

export function resolveLocationName(codeOrName?: string): string {
  if (!codeOrName) return "";
  const upper = codeOrName.trim().toUpperCase();
  return STATION_NAMES[upper] || codeOrName.trim();
}

export function formatPrice(price: number): string {
  return price.toLocaleString("vi-VN") + "đ";
}

export function formatTripTime(time: Date | string): {
  departureTime: string;
  arrivalTime: string;
  timeRange: string;
  dateFormatted: string;
} {
  const d = new Date(time);
  if (isNaN(d.getTime())) {
    const timeStr = String(time);
    return {
      departureTime: timeStr.split(" - ")[0] || timeStr,
      arrivalTime: timeStr.split(" - ")[1] || "",
      timeRange: timeStr,
      dateFormatted: "",
    };
  }

  const departureTime = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(d);
  const dateFormatted = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(d);
  // Database chưa có giờ đến; không tự cộng một thời lượng cố định cho mọi tuyến.
  return { departureTime, arrivalTime: "—", timeRange: departureTime, dateFormatted };
}
