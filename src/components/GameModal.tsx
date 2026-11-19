import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface GameModalProps {
  ariaLabel: string;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  closeLabel?: string;
  headerExtra?: React.ReactNode;
  maxWidthClass?: string;
  zIndexClass?: string;
  backdropClassName?: string;
  panelClassName?: string;
  headerBorderClassName?: string;
  closeButtonClassName?: string;
  children: React.ReactNode;
}

export const GameModal: React.FC<GameModalProps> = ({
  ariaLabel,
  onClose,
  title,
  subtitle,
  icon,
  closeLabel = 'Закрыть окно',
  headerExtra,
  maxWidthClass = 'max-w-md',
  zIndexClass = 'z-40',
  backdropClassName = 'bg-black/80',
  panelClassName = 'border border-[#3a4659] bg-[#080c12] p-5 font-ui text-[#d8e2ec] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_18px_40px_rgba(0,0,0,0.85)]',
  headerBorderClassName = 'border-b border-[#222d3c] pb-3 mb-4',
  closeButtonClassName = 'p-1 text-[#7b8a9c] hover:text-white cursor-pointer',
  children,
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (previousFocus && typeof previousFocus.focus === 'function') {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusable = Array.from(
      panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.getClientRects().length > 0);
    if (focusable.length === 0) {
      e.preventDefault();
      panelRef.current.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey) {
      if (active === first || active === panelRef.current || !panelRef.current.contains(active)) {
        e.preventDefault();
        last.focus({ preventScroll: true });
      }
    } else if (active === last || !panelRef.current.contains(active)) {
      e.preventDefault();
      first.focus({ preventScroll: true });
    }
  };

  return (
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center overflow-y-auto ${backdropClassName} p-4`}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={`my-auto w-full ${maxWidthClass} max-h-[92vh] overflow-y-auto outline-none ${panelClassName}`}
      >
        {(title !== undefined || headerExtra !== undefined) && (
          <div className={`flex flex-wrap items-center justify-between gap-2 ${headerBorderClassName}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {icon}
              <div className="min-w-0">
                {title !== undefined && (
                  <h2 className="font-display text-lg text-[#e8f0f7] leading-none tracking-wide">
                    {title}
                  </h2>
                )}
                {subtitle && <div className="text-xs text-[#7d97b2] mt-1">{subtitle}</div>}
              </div>
              {headerExtra}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className={closeButtonClassName}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
};
