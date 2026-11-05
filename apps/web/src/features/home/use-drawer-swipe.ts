import { useEffect, useRef, useState, type RefObject } from 'react';

/** How far the finger moves before the swipe counts as one: below that, it is a tap. */
const SLOP = 10;
/** Released after a third of the menu's width, or with a flick, the swipe goes through. */
const SHARE = 1 / 3;
const FLICK = 0.4; // px per ms
const SETTLE_MS = 200;

/** Where a swipe must not begin: text being edited, or something that scrolls sideways itself. */
function blocked(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"], [data-no-swipe]'))
    return true;
  for (let element: Element | null = target; element; element = element.parentElement) {
    if (element.scrollWidth <= element.clientWidth + 1) continue;
    const overflow = getComputedStyle(element).overflowX;
    if (overflow === 'auto' || overflow === 'scroll') return true;
  }
  return false;
}

/** The menu's width, also while it is still closed (as in the style sheet). */
function menuWidth(dialog: HTMLDialogElement): number {
  return dialog.open ? dialog.offsetWidth : Math.min(window.innerWidth * 0.86, 320);
}

interface Gesture {
  x: number;
  y: number;
  /** The last two positions, for the speed when the finger lets go. */
  lastX: number;
  lastT: number;
  prevX: number;
  prevT: number;
  mode: 'pending' | 'drag' | 'ignore';
  /** Opening a closed menu, or closing an open one. */
  opening: boolean;
}

/**
 * Swiping right opens the menu, swiping left closes it, as in the chat apps: the menu
 * follows the finger and, let go, slides open or back. Touch only; the menu button stays.
 * Returns whether the menu is being pulled open (then it is shown before it is open).
 */
export function useDrawerSwipe({
  dialog,
  open,
  onOpen,
  onClose,
}: {
  dialog: RefObject<HTMLDialogElement | null>;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}): boolean {
  const [pulling, setPulling] = useState(false);
  const gesture = useRef<Gesture | null>(null);
  // Read in the listeners, which stay the same while the menu opens and closes.
  const latest = useRef({ open, onOpen, onClose });
  useEffect(() => {
    latest.current = { open, onOpen, onClose };
  }, [open, onOpen, onClose]);

  useEffect(() => {
    const place = (element: HTMLDialogElement, x: number, width: number) => {
      element.style.transform = `translateX(${x}px)`;
      element.style.setProperty('--drawer-shown', String((width + x) / width));
    };

    const settle = (element: HTMLDialogElement, x: number, width: number, done: () => void) => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.style.transition = reduced ? 'none' : `transform ${SETTLE_MS}ms ease-out`;
      place(element, x, width);
      window.setTimeout(
        () => {
          element.style.transition = '';
          element.style.transform = '';
          element.style.removeProperty('--drawer-shown');
          done();
        },
        reduced ? 0 : SETTLE_MS,
      );
    };

    const onStart = (event: TouchEvent) => {
      const element = dialog.current;
      const touch = event.touches[0];
      gesture.current = null;
      if (!element || !touch || event.touches.length > 1) return;
      const { open: isOpen } = latest.current;
      // Another dialog is open (a form, a confirmation): its own business.
      const modal = document.querySelector('dialog[open]');
      if (modal && modal !== element) return;
      if (!isOpen && blocked(event.target)) return;
      const now = performance.now();
      gesture.current = {
        x: touch.clientX,
        y: touch.clientY,
        lastX: touch.clientX,
        lastT: now,
        prevX: touch.clientX,
        prevT: now,
        mode: 'pending',
        opening: !isOpen,
      };
    };

    const onMove = (event: TouchEvent) => {
      const element = dialog.current;
      const state = gesture.current;
      const touch = event.touches[0];
      if (!element || !state || !touch || state.mode === 'ignore') return;
      const dx = touch.clientX - state.x;
      const dy = touch.clientY - state.y;
      if (state.mode === 'pending') {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        const sideways = Math.abs(dx) > Math.abs(dy) * 1.2;
        const right = state.opening ? dx > 0 : dx < 0;
        if (!sideways || !right) {
          state.mode = 'ignore';
          return;
        }
        state.mode = 'drag';
        element.style.transition = 'none';
        // The menu's slide-in would cover the finger's position.
        element.style.animation = 'none';
        if (state.opening) {
          place(element, -menuWidth(element), menuWidth(element));
          setPulling(true);
        }
      }
      if (event.cancelable) event.preventDefault();
      const width = menuWidth(element);
      const x = Math.min(0, Math.max(-width, state.opening ? dx - width : dx));
      place(element, x, width);
      state.prevX = state.lastX;
      state.prevT = state.lastT;
      state.lastX = touch.clientX;
      state.lastT = performance.now();
    };

    const onEnd = () => {
      const element = dialog.current;
      const state = gesture.current;
      gesture.current = null;
      if (!element || !state || state.mode !== 'drag') return;
      const width = menuWidth(element);
      const moved = state.lastX - state.x;
      const speed = (state.lastX - state.prevX) / Math.max(1, state.lastT - state.prevT);
      if (state.opening) {
        if (moved > width * SHARE || speed > FLICK) {
          latest.current.onOpen();
          settle(element, 0, width, () => setPulling(false));
        } else {
          settle(element, -width, width, () => setPulling(false));
        }
      } else if (-moved > width * SHARE || speed < -FLICK) {
        settle(element, -width, width, () => latest.current.onClose());
      } else {
        settle(element, 0, width, () => undefined);
      }
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    // Not passive: a sideways swipe must not scroll the page as well.
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    document.addEventListener('touchcancel', onEnd);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', onEnd);
    };
  }, [dialog]);

  return pulling;
}
