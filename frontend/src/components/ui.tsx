import { type ReactNode, useEffect } from 'react';
import clsx from 'clsx';
import { Loader2, X } from 'lucide-react';
import type { JobState, StepStatus } from '../lib/types';

export function Card({ children, className, hover }: { children: ReactNode; className?: string; hover?: boolean }) {
  return <div className={clsx('glass p-5', hover && 'transition hover:border-brand-400/30 hover:bg-white/[0.06]', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6 animate-fadeUp">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">{title}</h1>
        {subtitle && <p className="text-slate-400 mt-1 text-sm md:text-base">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('w-5 h-5 animate-spin text-brand-400', className)} />;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'error' | 'running' | 'warn' | 'brand' }) {
  const tones: Record<string, string> = {
    neutral: 'bg-white/5 text-slate-300 border-white/10',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-400/25',
    error: 'bg-red-500/10 text-red-300 border-red-400/25',
    running: 'bg-brand-500/15 text-brand-300 border-brand-400/30',
    warn: 'bg-amber-500/10 text-amber-300 border-amber-400/25',
    brand: 'bg-gradient-to-r from-brand-500/20 to-accent/20 text-brand-200 border-brand-400/30',
  };
  return <span className={clsx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function StateBadge({ state }: { state: JobState }) {
  const map: Record<JobState, { tone: any; label: string }> = {
    queued: { tone: 'neutral', label: 'Queued' },
    running: { tone: 'running', label: 'Building' },
    success: { tone: 'success', label: 'Success' },
    failure: { tone: 'error', label: 'Failed' },
    cancelled: { tone: 'warn', label: 'Cancelled' },
  };
  const { tone, label } = map[state] || { tone: 'neutral', label: state };
  return <Badge tone={tone}>{label}</Badge>;
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={clsx('h-2 rounded-full bg-white/5 overflow-hidden border border-white/5', className)}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent transition-all duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400/60',
        checked ? 'bg-gradient-to-r from-brand-500 to-accent' : 'bg-white/10',
        disabled && 'opacity-40 pointer-events-none'
      )}
    >
      <span className={clsx('inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="glass p-10 flex flex-col items-center text-center gap-3 animate-fadeUp">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500/20 to-accent/20 border border-white/10 flex items-center justify-center text-brand-300">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      <p className="text-slate-400 text-sm max-w-md">{description}</p>
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('glass-strong relative z-10 w-full p-6 animate-fadeUp max-h-[85vh] overflow-y-auto', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-slate-300">{message}</p>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function StepDot({ status }: { status: StepStatus }) {
  if (status === 'done') {
    return <span className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center justify-center text-xs font-bold">✓</span>;
  }
  if (status === 'running') {
    return (
      <span className="w-7 h-7 rounded-full bg-brand-500/20 border border-brand-400/40 flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-brand-300" />
      </span>
    );
  }
  if (status === 'failed') {
    return <span className="w-7 h-7 rounded-full bg-red-500/20 border border-red-400/40 text-red-300 flex items-center justify-center text-xs font-bold">✕</span>;
  }
  return <span className="w-7 h-7 rounded-full bg-white/5 border border-white/10 text-slate-500 flex items-center justify-center text-xs font-bold" />;
}
