const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const nodes = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return nodes.filter(element => !element.hasAttribute('inert') && !element.closest('[inert]'));
}

export function focusFirstElement(container: HTMLElement, fallback?: HTMLElement | null): void {
  const focusable = getFocusableElements(container);
  const target = focusable[0] ?? fallback ?? null;

  if (target) {
    setTimeout(() => target.focus());
  }
}

export function cycleFocus(event: KeyboardEvent, container: HTMLElement): boolean {
  if (event.key !== 'Tab') {
    return false;
  }

  if (typeof document === 'undefined') {
    return false;
  }

  const focusable = getFocusableElements(container);
  if (focusable.length === 0) {
    return false;
  }

  const active = document.activeElement as HTMLElement | null;
  const currentIndex = active ? focusable.indexOf(active) : -1;
  const goingBackwards = event.shiftKey;

  let nextIndex: number;
  if (currentIndex === -1) {
    nextIndex = goingBackwards ? focusable.length - 1 : 0;
  } else if (goingBackwards) {
    nextIndex = currentIndex === 0 ? focusable.length - 1 : currentIndex - 1;
  } else {
    nextIndex = currentIndex === focusable.length - 1 ? 0 : currentIndex + 1;
  }

  focusable[nextIndex].focus();
  return true;
}
