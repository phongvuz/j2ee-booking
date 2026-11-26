export const tripStatuses = ["DRAFT", "OPEN", "DEPARTED", "COMPLETED", "CANCELLED"] as const;
export type TripStatus = typeof tripStatuses[number];

export const tripStatusTransitions: Record<string, readonly TripStatus[]> = {
  DRAFT: ["DRAFT", "OPEN", "CANCELLED"],
  OPEN: ["OPEN", "DRAFT", "DEPARTED", "CANCELLED"],
  DEPARTED: ["DEPARTED", "COMPLETED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
};

export const tripStatusLabels: Record<string, string> = {
  DRAFT: "Dự kiến",
  OPEN: "Mở bán",
  DEPARTED: "Đã xuất bến",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
