import { useEffect, useRef, useState, type RefObject } from 'react';

/** How far the finger moves before the swipe counts as one: below that, it is a tap. */
const SLOP = 10;
/** Released after a third of the menu's width, or with a flick, the swipe goes through. */
const SHARE = 1 / 3;
const FLICK = 0.4; // px per ms
const SETTLE_MS = 200;
/** In Safari a swipe from the left edge goes back a page; in the installed app it is free. */
const EDGE = 24;

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

const standalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** The menu's width, also while it is still closed (as in the style sheet). */
function menuWidth(dialog: HTMLDialogElement): number {
  return dialog.open && dialog.offsetWidth > 0
    ? dialog.offsetWidth
    : Math.min(window.innerWidth * 0.86, 320);
}

/** Takes back what a swipe set on the menu; the slide-in only once it is closed again. */
export function clearSwipe(dialog: HTMLDialogElement, keepAnimation = false): void {
  dialog.style.transition = '';
  dialog.style.transform = '';
  dialog.style.removeProperty('--drawer-shown');
  if (!keepAnimation) dialog.style.animation = '';
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
 * follows the finger and, let go, slides open or back. A second finger, a gesture the
 * system takes over or leaving the app lets it slide back. Touch only; the menu button
 * stays. Returns whether the menu is being pulled open: then it is shown, but not yet
 * opened as a dialog (the focus and the keyboard stay where they are).
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
    let timer = 0;
    let settling = false;

    const place = (element: HTMLDialogElement, x: number, width: number) => {
      element.style.transform = `translateX(${x}px)`;
      element.style.setProperty('--drawer-shown', String((width + x) / width));
    };

    /**
     * Slides the menu to x, then finishes. Where it goes away it is closed before the
     * position is taken back, so that it never shows fully open for a moment.
     */
    const settle = (
      element: HTMLDialogElement,
      x: number,
      width: number,
      away: boolean,
      done: () => void,
    ) => {
      settling = true;
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      element.style.transition = reduced ? 'none' : `transform ${SETTLE_MS}ms ease-out`;
      place(element, x, width);
      timer = window.setTimeout(
        () => {
          settling = false;
          if (away && element.open) element.close();
          clearSwipe(element, !away);
          done();
        },
        reduced ? 0 : SETTLE_MS,
      );
    };

    /** Back to where the gesture began. */
    const cancel = () => {
      const element = dialog.current;
      const state = gesture.current;
      gesture.current = null;
      if (!element || !state || state.mode !== 'drag') return;
      const width = menuWidth(element);
      if (state.opening) settle(element, -width, width, true, () => setPulling(false));
      else settle(element, 0, width, false, () => undefined);
    };

    const onStart = (event: TouchEvent) => {
      const element = dialog.current;
      const touch = event.touches[0];
      if (settling) return;
      if (event.touches.length > 1) {
        cancel();
        return;
      }
      gesture.current = null;
      if (!element || !touch) return;
      const { open: isOpen } = latest.current;
      // Another dialog is open (a form, a confirmation): its own business.
      const modal = document.querySelector('dialog[open]');
      if (modal && modal !== element) return;
      if (!isOpen && (blocked(event.target) || (touch.clientX < EDGE && !standalone()))) return;
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
          settle(element, 0, width, false, () => {
            setPulling(false);
            latest.current.onOpen();
          });
        } else {
          settle(element, -width, width, true, () => setPulling(false));
        }
      } else if (-moved > width * SHARE || speed < -FLICK) {
        settle(element, -width, width, true, () => latest.current.onClose());
      } else {
        settle(element, 0, width, false, () => undefined);
      }
    };

    const onHidden = () => {
      if (document.visibilityState === 'hidden') cancel();
    };

    document.addEventListener('touchstart', onStart, { passive: true });
    // Not passive: a sideways swipe must not scroll the page as well. Without a gesture
    // the listener returns at once.
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    // Taken over by the system (say, its own back gesture): back, not through.
    document.addEventListener('touchcancel', cancel);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      document.removeEventListener('touchcancel', cancel);
      document.removeEventListener('visibilitychange', onHidden);
      window.clearTimeout(timer);
    };
  }, [dialog]);

  return pulling;
}
