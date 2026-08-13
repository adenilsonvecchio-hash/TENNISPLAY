import React, { useState, useEffect } from 'react';
import { toast, ToastMessage } from '../lib/toast';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return toast.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 z-[9999] flex flex-col gap-2 max-w-sm w-[90vw] pointer-events-none transition-all">
      {toasts.map((t) => {
        const isSuccess = t.type === 'success';
        const isError = t.type === 'error';

        return (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl shadow-xl transition-all transform animate-in fade-in slide-in-from-top-4 duration-300 ${
              isSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-950/20'
                : isError
                ? 'bg-rose-600 text-white shadow-rose-950/20'
                : 'bg-slate-900 text-white shadow-slate-950/20'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-100" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-100" />}
              {!isSuccess && !isError && <Info className="w-5 h-5 text-slate-100" />}
            </div>
            <p className="text-xs sm:text-sm font-bold leading-snug tracking-tight pr-1">
              {t.message}
            </p>
          </div>
        );
      })}
    </div>
  );
}
