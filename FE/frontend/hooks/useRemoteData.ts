"use client";

import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "@/lib/api-client";

interface RemoteResult<T> {
  data: T;
  error: string | null;
  source: ((signal: AbortSignal) => Promise<T>) | null;
  version: number;
}

// T là kiểu dữ liệu của API, ví dụ danh sách chuyến xe hoặc thống kê.
export function useRemoteData<T>(
  load: (signal: AbortSignal) => Promise<T>,
  initialData: T,
) {
  // Tăng version để tải lại ngay cả khi bộ lọc không đổi.
  const [version, setVersion] = useState(0);
  const [result, setResult] = useState<RemoteResult<T>>({
    data: initialData,
    error: null,
    source: null,
    version: -1,
  });

  useEffect(() => {
    const controller = new AbortController();
    const request = load(controller.signal);

    async function fetchData() {
      try {
        const data = await request;

        // Bỏ qua kết quả cũ nếu người dùng đã đổi bộ lọc hoặc rời trang.
        if (controller.signal.aborted) {
          return;
        }

        setResult({ data, error: null, source: load, version });
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setResult(function keepPreviousData(previous) {
          return {
            data: previous.data,
            error: getErrorMessage(error),
            source: load,
            version,
          };
        });
      }
    }

    fetchData();

    // React gọi hàm này trước lần tải tiếp theo và khi component bị gỡ.
    return function cancelRequest() {
      controller.abort();
    };
  }, [load, version]);

  const refresh = useCallback(function refresh() {
    setVersion(function increaseVersion(previous) {
      return previous + 1;
    });
  }, []);
  // Nếu kết quả chưa thuộc bộ lọc/lần tải hiện tại thì vẫn đang tải.
  const loading = result.source !== load || result.version !== version;
  let error = result.error;
  if (loading) {
    error = null;
  }

  return { data: result.data, error, loading, refresh };
}
