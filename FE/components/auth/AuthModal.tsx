"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { FiNavigation, FiX } from "react-icons/fi";
import { authModalUrl, safeAuthReturnTo, type AuthMode } from "@/lib/auth-navigation";
import LoginForm from "./LoginForm";
import RegisterForm from "./RegisterForm";

function AuthDialog({ mode, onClose, onSwitch, onLogin }: {
  mode: AuthMode;
  onClose: () => void;
  onSwitch: (mode: AuthMode) => void;
  onLogin: (redirectTo: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isLogin = mode === "login";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    dialog.querySelector("input")?.focus({ preventScroll: true });
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="auth-modal-title"
      aria-describedby="auth-modal-description"
      aria-modal="true"
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-3xl border border-brand-border bg-white p-0 text-brand-text shadow-2xl backdrop:bg-slate-950/50 backdrop:backdrop-blur-sm"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex="0"]',
        )).filter((element) => element.getClientRects().length > 0);
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
    >
      <div className="sticky top-0 z-10 flex justify-end bg-white/95 px-4 pt-4 backdrop-blur-sm">
        <button type="button" onClick={onClose} aria-label="Đóng cửa sổ" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-slate-500 transition hover:bg-brand-light hover:text-brand-primary focus-visible:outline-2 focus-visible:outline-brand-primary">
          <FiX aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div className="px-6 pb-8 sm:px-8">
        <div className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-light text-brand-primary">
            <FiNavigation aria-hidden="true" className="h-6 w-6" />
          </span>
          <h2 id="auth-modal-title" className="mt-4 text-2xl font-black tracking-tight">
            {isLogin ? "Đăng nhập" : "Đăng ký tài khoản"}
          </h2>
          <p id="auth-modal-description" className="mt-2 text-sm text-slate-500">
            {isLogin ? "Chào mừng bạn trở lại. Tiếp tục hành trình cùng NOMAD." : "Tạo tài khoản để đặt vé và quản lý chuyến đi dễ dàng."}
          </p>
        </div>
        {isLogin ? <LoginForm onSuccess={onLogin} onRegister={() => onSwitch("register")} /> : <RegisterForm onSuccess={onLogin} onLogin={() => onSwitch("login")} />}
      </div>
    </dialog>
  );
}

export default function AuthModal() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mode = searchParams.get("auth");
  if (mode !== "login" && mode !== "register") return null;

  const cleanUrl = () => `${authModalUrl(pathname, searchParams.toString(), null)}${window.location.hash}`;
  return <AuthDialog
    key={mode}
    mode={mode}
    onClose={() => window.history.replaceState(null, "", cleanUrl())}
    onSwitch={(nextMode) => window.history.replaceState(null, "", `${authModalUrl(pathname, searchParams.toString(), nextMode)}${window.location.hash}`)}
    onLogin={(redirectTo) => {
      const destination = redirectTo === "/admin" ? "/admin" : safeAuthReturnTo(searchParams.get("next"));
      // Reload the destination so shared layouts and prefetched pages use the new session cookie.
      window.location.replace(destination ?? cleanUrl());
    }}
  />;
}
