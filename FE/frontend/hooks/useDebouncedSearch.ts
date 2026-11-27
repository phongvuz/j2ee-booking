"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useDebouncedSearch(initialValue: string, onApply: () => void) {
  const [search, setSearch] = useState(initialValue);
  const [appliedSearch, setAppliedSearch] = useState(initialValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(function cancelSearchTimer() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
    }
    timer.current = null;
  }, []);

  const changeSearch = useCallback(function changeSearch(value: string) {
    setSearch(value);
    cancel();
    // Chờ 350ms sau lần gõ cuối rồi mới gửi từ khóa đến API.
    timer.current = setTimeout(function applySearch() {
      setAppliedSearch(value);
      onApply();
      timer.current = null;
    }, 350);
  }, [cancel, onApply]);

  const resetSearch = useCallback(function resetSearch() {
    cancel();
    setSearch("");
    setAppliedSearch("");
  }, [cancel]);

  useEffect(function cleanupSearch() {
    return cancel;
  }, [cancel]);
  return { search, appliedSearch, changeSearch, resetSearch };
}
