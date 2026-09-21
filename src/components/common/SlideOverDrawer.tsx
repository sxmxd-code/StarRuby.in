import React, { useEffect, useState } from 'react';
import { X, Trash2 } from 'lucide-react';

interface SlideOverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  lastIdReference?: string;
  onSubmit?: (e: React.FormEvent) => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  onDelete?: () => void;
  deleteLabel?: string;
  children: React.ReactNode;
  widthClass?: 'max-w-md' | 'max-w-lg' | 'max-w-xl' | 'max-w-2xl' | 'max-w-3xl' | string;
}

const WIDTH_CLASS_MAP: Record<string, string> = {
  'max-w-md': 'sm:max-w-md',
  'max-w-lg': 'sm:max-w-lg',
  'max-w-xl': 'sm:max-w-xl',
  'max-w-2xl': 'sm:max-w-2xl',
  'max-w-3xl': 'sm:max-w-3xl',
};

export const SlideOverDrawer: React.FC<SlideOverDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  lastIdReference,
  onSubmit,
  submitLabel = 'Save Changes',
  isSubmitting = false,
  onDelete,
  deleteLabel = 'Delete Record',
  children,
  widthClass = 'max-w-xl',
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      const timer = requestAnimationFrame(() => {
        setIsAnimating(true);
      });
      return () => cancelAnimationFrame(timer);
    } else {
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setIsRendered(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isRendered) return null;

  const resolvedWidth = WIDTH_CLASS_MAP[widthClass] || 'sm:max-w-xl';

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300 ease-out ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Container (Pinned strictly to the Right Edge) */}
      <div className="fixed inset-y-0 right-0 pl-0 sm:pl-10 max-w-full flex pointer-events-none">
        <div
          className={`w-screen max-w-full ${resolvedWidth} bg-white shadow-2xl border-l border-slate-200 flex flex-col h-full pointer-events-auto transform transition-transform duration-300 ease-out ${
            isAnimating ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-start justify-between shrink-0">
            <div className="space-y-1 pr-3">
              <div className="flex items-center space-x-2 sm:space-x-2.5 flex-wrap gap-y-1">
                <h2 className="text-sm sm:text-base font-bold font-serif text-slate-900">{title}</h2>
                {lastIdReference && (
                  <span className="px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-bold font-mono bg-rose-100 text-rose-800 border border-rose-200">
                    {lastIdReference}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-[11px] sm:text-xs text-slate-500">{subtitle}</p>}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer shrink-0"
              title="Close drawer (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form Content / Body */}
          <form
            onSubmit={e => {
              if (onSubmit) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            className="flex flex-col flex-1 min-h-0"
          >
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 text-xs">
              {children}
            </div>

            {/* Footer */}
            <div className="p-3 sm:p-4 border-t border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0 gap-2 sm:gap-3">
              <div>
                {onDelete && (
                  <button
                    type="button"
                    onClick={onDelete}
                    className="flex items-center space-x-1.5 px-2.5 sm:px-3 py-2 text-rose-700 hover:bg-rose-100/70 rounded-lg text-xs font-semibold transition border border-rose-200 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">{deleteLabel}</span>
                    <span className="xs:hidden">Delete</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3 sm:px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  Cancel
                </button>
                {onSubmit && (
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 sm:px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Saving...' : submitLabel}
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
