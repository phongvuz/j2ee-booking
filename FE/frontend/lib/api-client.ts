export class ApiError extends Error {
  constructor(message: string, public status?: number, public errors?: unknown[]) {
    super(message);
    this.name = "ApiError";
  }
}

export function getErrorMessage(error: unknown, fallback = "Có lỗi xảy ra. Vui lòng thử lại!") {
  return error instanceof Error ? error.message : fallback;
}

// Chỉ thêm tham số có giá trị; không cần timestamp để tránh cache.
export function buildQuery(params: object): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  }
  return query.toString();
}

export async function requestJson<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers,
  });
  let data: T & { success?: boolean; message?: string; errors?: unknown[] };
  try {
    data = await response.json();
  } catch {
    throw new ApiError("Máy chủ trả về dữ liệu không hợp lệ. Vui lòng thử lại!", response.status);
  }
  if (!data || !response.ok || data.success === false) {
    throw new ApiError(data?.message || "Không thể thực hiện yêu cầu. Vui lòng thử lại!", response.status, data?.errors);
  }
  return data;
}
