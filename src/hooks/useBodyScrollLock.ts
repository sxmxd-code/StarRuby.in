import { useEffect } from 'react';

let lockCount = 0;
let originalBodyOverflow = '';
let originalBodyPaddingRight = '';
let originalMainOverflow = '';

/**
 * Robust scroll lock hook for full-screen modals, drawers, and boards.
 * Locks both document.body and the scrollable <main> container to guarantee
 * zero background movement while an overlay is active.
 * Uses reference counting so nested or chained modals never prematurely unlock scroll.
 */
export const useBodyScrollLock = (isLocked: boolean = true) => {
  useEffect(() => {
    if (!isLocked || typeof document === 'undefined') return;

    if (lockCount === 0) {
      originalBodyOverflow = document.body.style.overflow;
      originalBodyPaddingRight = document.body.style.paddingRight;
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      const mainContainer = document.querySelector('main');
      if (mainContainer) {
        originalMainOverflow = mainContainer.style.overflow;
        mainContainer.style.overflow = 'hidden';
      }
    }

    lockCount++;

    return () => {
      lockCount = Math.max(0, lockCount - 1);
      if (lockCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
        document.body.style.paddingRight = originalBodyPaddingRight;
        const mainContainer = document.querySelector('main');
        if (mainContainer) {
          mainContainer.style.overflow = originalMainOverflow;
        }
      }
    };
  }, [isLocked]);
};
