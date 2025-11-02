const ACTIVE_ANIMATIONS = new WeakMap<HTMLElement, number>();

const easeRegistry = new Map<string, (value: number) => number>();

type NumericProperty = 'width' | 'height' | 'x' | 'y';

interface CompleteState {
  width: number;
  height: number;
  x: number;
  y: number;
}

type NumericState = Partial<CompleteState>;

export interface AnimationVars extends NumericState {
  duration?: number;
  ease?: string | ((value: number) => number);
  onComplete?: () => void;
}

export interface AnimationHandle {
  cancel(): void;
  kill(): void;
}

const DEFAULT_DURATION = 0.6;
const DEFAULT_EASE = (value: number): number => value;

function ensureHTMLElement(target: Element | HTMLElement): HTMLElement {
  if (target instanceof HTMLElement) {
    return target;
  }
  if (target instanceof Element && 'style' in target) {
    return target as HTMLElement;
  }
  throw new TypeError('Animation target must be an HTMLElement');
}

function readStoredTranslation(element: HTMLElement): { x: number; y: number } {
  const storedX = Number.parseFloat(element.dataset.gsapLiteTranslateX ?? '0');
  const storedY = Number.parseFloat(element.dataset.gsapLiteTranslateY ?? '0');
  return {
    x: Number.isFinite(storedX) ? storedX : 0,
    y: Number.isFinite(storedY) ? storedY : 0,
  };
}

function applyFrame(element: HTMLElement, frame: NumericState): void {
  if (frame.width !== undefined) {
    element.style.width = `${frame.width}px`;
  }
  if (frame.height !== undefined) {
    element.style.height = `${frame.height}px`;
  }

  const currentTranslation = readStoredTranslation(element);
  const nextX = frame.x ?? currentTranslation.x;
  const nextY = frame.y ?? currentTranslation.y;

  element.style.transform = `translate3d(${nextX}px, ${nextY}px, 0)`;
  element.dataset.gsapLiteTranslateX = String(nextX);
  element.dataset.gsapLiteTranslateY = String(nextY);
}

function getInitialState(element: HTMLElement, overrides: NumericState): CompleteState {
  const rect = element.getBoundingClientRect();
  const translation = readStoredTranslation(element);
  return {
    width: overrides.width ?? rect.width,
    height: overrides.height ?? rect.height,
    x: overrides.x ?? translation.x,
    y: overrides.y ?? translation.y,
  };
}

function createCubicBezier(p1x: number, p1y: number, p2x: number, p2y: number): (value: number) => number {
  const cx = 3 * p1x;
  const bx = 3 * (p2x - p1x) - cx;
  const ax = 1 - cx - bx;

  const cy = 3 * p1y;
  const by = 3 * (p2y - p1y) - cy;
  const ay = 1 - cy - by;

  const sampleCurveX = (t: number): number => ((ax * t + bx) * t + cx) * t;
  const sampleCurveY = (t: number): number => ((ay * t + by) * t + cy) * t;
  const sampleDerivativeX = (t: number): number => (3 * ax * t + 2 * bx) * t + cx;

  const solveForT = (x: number): number => {
    let t = x;

    for (let i = 0; i < 8; i += 1) {
      const xEstimate = sampleCurveX(t) - x;
      const derivative = sampleDerivativeX(t);

      if (Math.abs(xEstimate) < 1e-6 || derivative === 0) {
        return t;
      }

      t -= xEstimate / derivative;
    }

    // Fallback to binary subdivision for cases with a flat derivative.
    let t0 = 0;
    let t1 = 1;
    t = x;

    while (t0 < t1) {
      const xEstimate = sampleCurveX(t);
      if (Math.abs(xEstimate - x) < 1e-6) {
        return t;
      }
      if (x > xEstimate) {
        t0 = t;
      } else {
        t1 = t;
      }
      t = (t0 + t1) / 2;
    }

    return t;
  };

  return (value: number) => {
    if (value <= 0) {
      return 0;
    }
    if (value >= 1) {
      return 1;
    }
    const t = solveForT(value);
    return sampleCurveY(t);
  };
}

function parseEase(ease?: string | ((value: number) => number)): (value: number) => number {
  if (typeof ease === 'function') {
    return ease;
  }
  if (typeof ease === 'string') {
    if (ease.startsWith('cubic-bezier(') && ease.endsWith(')')) {
      const args = ease
        .slice('cubic-bezier('.length, -1)
        .split(',')
        .map(part => Number.parseFloat(part.trim()));
      if (args.length === 4 && args.every(number => Number.isFinite(number))) {
        return createCubicBezier(args[0], args[1], args[2], args[3]);
      }
    }
    const registered = easeRegistry.get(ease);
    if (registered) {
      return registered;
    }
  }
  return DEFAULT_EASE;
}

function animateElement(element: HTMLElement, fromState: NumericState, toState: AnimationVars): AnimationHandle {
  const starting = getInitialState(element, fromState);
  const ending: CompleteState = {
    width: toState.width ?? starting.width,
    height: toState.height ?? starting.height,
    x: toState.x ?? starting.x,
    y: toState.y ?? starting.y,
  };

  const animatedProps = (['width', 'height', 'x', 'y'] as NumericProperty[]).filter(
    property => starting[property] !== ending[property],
  );

  const durationMs = Math.max(0, (toState.duration ?? DEFAULT_DURATION)) * 1000;
  const easing = parseEase(toState.ease);

  applyFrame(element, starting);

  if (animatedProps.length === 0 || durationMs === 0) {
    applyFrame(element, ending);
    if (toState.onComplete) {
      toState.onComplete();
    }
    return {
      cancel: () => undefined,
      kill: () => undefined,
    };
  }

  const deltas = animatedProps.reduce<CompleteState>((accumulator, property) => {
    accumulator[property] = ending[property] - starting[property];
    return accumulator;
  }, { width: 0, height: 0, x: 0, y: 0 });

  const startTime = performance.now();
  let frame = 0;

  const step = (timestamp: number): void => {
    const progress = Math.min(1, durationMs === 0 ? 1 : (timestamp - startTime) / durationMs);
    const eased = easing(progress);

    const frameState: NumericState = {};
    for (const property of animatedProps) {
      frameState[property] = starting[property] + deltas[property] * eased;
    }

    applyFrame(element, frameState);

    if (progress < 1) {
      frame = requestAnimationFrame(step);
      ACTIVE_ANIMATIONS.set(element, frame);
    } else {
      applyFrame(element, ending);
      ACTIVE_ANIMATIONS.delete(element);
      if (toState.onComplete) {
        toState.onComplete();
      }
    }
  };

  const cancel = (): void => {
    const activeFrame = ACTIVE_ANIMATIONS.get(element);
    if (activeFrame !== undefined) {
      cancelAnimationFrame(activeFrame);
      ACTIVE_ANIMATIONS.delete(element);
    }
  };

  cancel();
  frame = requestAnimationFrame(step);
  ACTIVE_ANIMATIONS.set(element, frame);

  return {
    cancel,
    kill: cancel,
  };
}

const pluginRegistry = new Set<unknown>();

export const gsap = {
  registerPlugin(...plugins: unknown[]): void {
    for (const plugin of plugins) {
      pluginRegistry.add(plugin);
    }
  },
  fromTo(target: Element | HTMLElement, fromVars: NumericState, toVars: AnimationVars): AnimationHandle {
    return animateElement(ensureHTMLElement(target), fromVars, toVars);
  },
  to(target: Element | HTMLElement, vars: AnimationVars): AnimationHandle {
    const element = ensureHTMLElement(target);
    const currentState: NumericState = {};
    if (vars.width !== undefined) {
      currentState.width = element.getBoundingClientRect().width;
    }
    if (vars.height !== undefined) {
      currentState.height = element.getBoundingClientRect().height;
    }
    if (vars.x !== undefined) {
      currentState.x = readStoredTranslation(element).x;
    }
    if (vars.y !== undefined) {
      currentState.y = readStoredTranslation(element).y;
    }
    return animateElement(element, currentState, vars);
  },
};

export class CustomEase {
  static create(name: string, definition: string): void {
    const parts = definition
      .split(',')
      .map(section => Number.parseFloat(section.trim()));

    if (parts.length !== 4 || parts.some(part => !Number.isFinite(part))) {
      throw new Error(`Invalid CustomEase definition: "${definition}"`);
    }

    easeRegistry.set(name, createCubicBezier(parts[0], parts[1], parts[2], parts[3]));
  }
}

// Provide a default linear easing so callers can rely on it always existing.
easeRegistry.set('linear', DEFAULT_EASE);
