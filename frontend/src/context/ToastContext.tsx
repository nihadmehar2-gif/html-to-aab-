import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ toast: (kind: ToastKind, message: string) => void }>({
  toast: () => undefined,
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const toast = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }].slice(-4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-20 md:bottom-6 right-4 left-4 md:left-auto md:w-96 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`glass-strong px-4 py-3 flex items-start gap-3 animate-fadeUp text-sm ${
              t.kind === 'success' ? 'border-emerald-400/30' : t.kind === 'error' ? 'border-red-400/30' : 'border-brand-400/30'
            }`}
          >
            {t.kind === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : t.kind === 'error' ? (
              <XCircle className="w-5 h-5 text-red-400 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-brand-300 shrink-0" />
            )}
            <span className="text-slate-200">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
