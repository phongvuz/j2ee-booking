"use client";

import { FiAlertTriangle, FiCheck, FiInfo, FiX } from "react-icons/fi";
import React, { createContext, useContext, useState, useCallback } from "react";

type ToastType = "success" | "error" | "info" | "warning";

interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastContextType {
  toast: (options: { type?: ToastType; title?: string; message: string; duration?: number }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      type = "info",
      title,
      message,
      duration = 4000,
    }: {
      type?: ToastType;
      title?: string;
      message: string;
      duration?: number;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { id, type, title, message };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, title: string = "Thành công") =>
      toast({ type: "success", title, message }),
    [toast]
  );

  const error = useCallback(
    (message: string, title: string = "Có lỗi xảy ra") =>
      toast({ type: "error", title, message }),
    [toast]
  );

  const info = useCallback(
    (message: string, title: string = "Thông báo") =>
      toast({ type: "info", title, message }),
    [toast]
  );

  const warning = useCallback(
    (message: string, title: string = "Cảnh báo") =>
      toast({ type: "warning", title, message }),
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, info, warning }}>
      {children}

      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 pointer-events-none max-w-sm w-full px-4">
        {toasts.map((item) => {
          let toastClassName = "bg-white/95 border-blue-300 text-gray-800 ring-1 ring-blue-500/20";
          if (item.type === "success") {
            toastClassName = "bg-white/95 border-emerald-300 text-gray-800 ring-1 ring-emerald-500/20";
          } else if (item.type === "error") {
            toastClassName = "bg-white/95 border-rose-300 text-gray-800 ring-1 ring-rose-500/20";
          } else if (item.type === "warning") {
            toastClassName = "bg-white/95 border-amber-300 text-gray-800 ring-1 ring-amber-500/20";
          }

          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${toastClassName}`}
            >
              {/* Status Icon */}
              <div className="shrink-0 mt-0.5">
                {item.type === "success" && (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-sm">
                    <FiCheck aria-hidden="true" className="inline-block shrink-0 align-middle" />
                  </div>
                )}
                {item.type === "error" && (
                  <div className="w-7 h-7 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-sm">
                    <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
                  </div>
                )}
                {item.type === "warning" && (
                  <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-sm">
                    <FiAlertTriangle aria-hidden="true" className="inline-block shrink-0 align-middle" />
                  </div>
                )}
                {item.type === "info" && (
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
                    <FiInfo aria-hidden="true" className="inline-block shrink-0 align-middle" />
                  </div>
                )}
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                {item.title && (
                  <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-0.5">
                    {item.title}
                  </h4>
                )}
                <p className="text-xs text-gray-600 leading-relaxed break-words">
                  {item.message}
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => removeToast(item.id)}
                className="shrink-0 text-gray-400 hover:text-gray-600 text-sm p-1 rounded transition-colors cursor-pointer"
                aria-label="Đóng"
              >
                <FiX aria-hidden="true" className="inline-block shrink-0 align-middle" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
