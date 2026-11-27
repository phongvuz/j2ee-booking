"use client";

import { FiUser } from "react-icons/fi";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import LogoutButton from "./LogoutButton";

export default function CustomerDropdown() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return <div
    ref={container}
    className="relative"
    onPointerEnter={(event) => {
      if (event.pointerType === "mouse") setOpen(true);
    }}
    onPointerLeave={(event) => {
      if (event.pointerType !== "mouse") return;
      if (!container.current?.contains(document.activeElement)) setOpen(false);
    }}
    onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}
    onKeyDown={(event) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    }}
  >
    <button
      ref={trigger}
      type="button"
      aria-label="Các chức năng tài khoản"
      aria-expanded={open}
      aria-controls={panelId}
      onClick={() => setOpen((value) => !value)}
      className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-orange-50 text-brand-primary hover:bg-orange-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
    >
      <FiUser aria-hidden="true" width="22" height="22" />
    </button>
    <div id={panelId} hidden={!open} className="absolute right-0 top-full z-50 w-56 pt-2">
      <div className="overflow-hidden rounded-xl border border-gray-100 bg-white p-2 shadow-lg">
        <Link href="/profile" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-brand-primary focus-visible:bg-orange-50">Hồ sơ người dùng</Link>
        <Link href="/bookings" onClick={() => setOpen(false)} className="block rounded-lg px-4 py-3 text-sm font-medium text-gray-700 hover:bg-orange-50 hover:text-brand-primary focus-visible:bg-orange-50">Lịch sử đặt vé</Link>
        <div className="mt-1 border-t border-gray-100 pt-1">
          <LogoutButton className="w-full cursor-pointer rounded-lg px-4 py-3 text-left text-sm font-medium text-brand-primary hover:bg-orange-50 focus-visible:bg-orange-50 disabled:opacity-50" />
        </div>
      </div>
    </div>
  </div>;
}
