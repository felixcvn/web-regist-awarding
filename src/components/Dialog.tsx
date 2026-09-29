'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info } from 'lucide-react';

export type DialogVariant = 'danger' | 'info';

interface DialogProps {
  open: boolean;
  title: string;
  message: string;
  variant?: DialogVariant;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm?: () => void;
  onClose: () => void;
}

export default function Dialog({
  open,
  title,
  message,
  variant = 'info',
  confirmLabel,
  cancelLabel = 'Batal',
  busy = false,
  onConfirm,
  onClose,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  const isDanger = variant === 'danger';
  const accent = isDanger ? '#FFB5E8' : '#AFF8DB';
  const Icon = isDanger ? AlertTriangle : Info;
  const confirmText = confirmLabel || (isDanger ? 'Hapus' : 'Mengerti');

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-surface-base/80 backdrop-blur-sm animate-[fadeIn_150ms_ease-out]"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-3xl overflow-hidden border bg-gradient-to-b from-surface-card via-surface-card-2 to-surface-base shadow-[0_0_60px_rgba(0,0,0,0.85)] animate-[dialogIn_180ms_cubic-bezier(0.16,1,0.3,1)]"
        style={{ borderColor: `${accent}66` }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />

        <div className="p-6 sm:p-8">
          <div className="flex flex-col items-center text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center border"
              style={{ background: `${accent}1f`, borderColor: `${accent}59` }}
            >
              <Icon className="w-8 h-8" style={{ color: accent }} />
            </div>
            <h3 className="font-cinzel text-lg sm:text-xl font-bold text-ivory tracking-wide mt-4">
              {title}
            </h3>
            <p className="mt-2 text-sm text-ink/75 leading-relaxed whitespace-pre-line max-w-sm">
              {message}
            </p>
          </div>

          <div className="flex items-center gap-3 mt-7">
            {isDanger && (
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="flex-1 px-5 py-2.5 rounded-xl bg-surface-card border border-bloom-pink/30 text-xs font-semibold text-ink hover:bg-surface-card transition-colors disabled:opacity-50 cursor-pointer"
              >
                {cancelLabel}
              </button>
            )}
            <button
              type="button"
              onClick={onConfirm || onClose}
              disabled={busy}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 cursor-pointer"
              style={
                isDanger
                  ? { background: '#7f1d1d', color: '#fecaca', border: '1px solid rgba(248,113,113,0.5)' }
                  : { background: accent, color: '#061811' }
              }
            >
              {busy && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
