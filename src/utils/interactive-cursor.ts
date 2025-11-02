interface Vector2 {
  x: number;
  y: number;
  lerp(target: Vector2, amount: number): void;
}

const createVector2 = (x: number, y: number): Vector2 => ({
  x,
  y,
  lerp(target: Vector2, amount: number) {
    this.x += (target.x - this.x) * amount;
    this.y += (target.y - this.y) * amount;
  },
});

type TickerCallback = (time: number, deltaTime: number, frame: number) => void;

interface GsapLike {
  set(target: Element | Element[] | NodeListOf<Element> | string, vars: Record<string, unknown>): void;
  to(target: Element | Element[] | NodeListOf<Element> | string, vars: Record<string, unknown>): void;
  killTweensOf(target: Element | Element[] | NodeListOf<Element> | string): void;
  ticker: {
    add(callback: TickerCallback): void;
    remove(callback: TickerCallback): void;
  };
}

declare global {
  interface Window {
    gsap?: GsapLike;
  }
}

class InteractiveCursor {
  private readonly gsap: GsapLike;

  private readonly position = {
    target: createVector2(window.innerWidth / 2, window.innerHeight / 2),
    current: createVector2(window.innerWidth / 2, window.innerHeight / 2),
    lerpAmount: 0.2,
  };

  private isHoveringTarget = false;

  private readonly updateTick = () => {
    this.position.current.lerp(this.position.target, this.position.lerpAmount);

    if (!this.isHoveringTarget) {
      this.gsap.set(this.cursor, {
        x: this.position.current.x,
        y: this.position.current.y,
      });
    }
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    this.position.target.x = event.clientX;
    this.position.target.y = event.clientY;
  };

  private readonly handlePointerEnter = (event: Event) => {
    const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-hover-trigger]');
    if (!trigger) {
      return;
    }

    const targetElement = trigger.closest<HTMLElement>('[data-hover-target]');
    if (!targetElement) {
      return;
    }

    const targetRect = targetElement.getBoundingClientRect();
    this.isHoveringTarget = true;

    this.gsap.to(this.cursor, {
      x: targetRect.left,
      y: targetRect.top,
      width: targetRect.width,
      height: targetRect.height,
      borderRadius: '10px',
      duration: 0.5,
      ease: 'power4.out',
      overwrite: true,
      xPercent: 0,
      yPercent: 0,
    });
  };

  private readonly handlePointerLeave = (event: Event) => {
    const trigger = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-hover-trigger]');
    if (!trigger) {
      return;
    }

    this.isHoveringTarget = false;

    this.gsap.killTweensOf(this.cursor);

    this.position.current.x = this.position.target.x;
    this.position.current.y = this.position.target.y;

    this.gsap.to(this.cursor, {
      width: 20,
      height: 20,
      borderRadius: '5px',
      duration: 0.5,
      ease: 'power4.out',
      overwrite: true,
      xPercent: -50,
      yPercent: -50,
    });
  };

  constructor(private readonly cursor: HTMLElement, gsapInstance: GsapLike) {
    this.gsap = gsapInstance;
    this.init();
  }

  private init(): void {
    this.gsap.set(this.cursor, { xPercent: -50, yPercent: -50 });
    this.gsap.ticker.add(this.updateTick);

    window.addEventListener('pointermove', this.handlePointerMove);
    document.addEventListener('pointerenter', this.handlePointerEnter, true);
    document.addEventListener('pointerleave', this.handlePointerLeave, true);
  }
}

let interactiveCursorInstance: InteractiveCursor | null = null;

export const initializeInteractiveCursor = (): void => {
  if (typeof window === 'undefined') {
    return;
  }

  if (interactiveCursorInstance) {
    return;
  }

  const gsapInstance = window.gsap;
  if (!gsapInstance) {
    console.warn('GSAP não está disponível. O cursor interativo não será inicializado.');
    return;
  }

  const cursorElement = document.querySelector<HTMLElement>('.custom-cursor');
  if (!cursorElement) {
    console.warn('Elemento do cursor customizado não encontrado.');
    return;
  }

  interactiveCursorInstance = new InteractiveCursor(cursorElement, gsapInstance);
};
