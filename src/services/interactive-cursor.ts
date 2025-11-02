const CURSOR_POINTER_SELECTOR = '[data-cursor-pointer]';

interface CursorPoint {
  x: number;
  y: number;
}

interface CursorVec2 extends CursorPoint {
  lerp(target: CursorPoint, amount: number): void;
}

const createVec2 = (x: number, y: number): CursorVec2 => ({
  x,
  y,
  lerp(target: CursorPoint, amount: number): void {
    this.x += (target.x - this.x) * amount;
    this.y += (target.y - this.y) * amount;
  },
});

export class InteractiveCursor {
  private readonly cursorElement: HTMLElement;
  private readonly position = {
    target: createVec2(window.innerWidth / 2, window.innerHeight / 2),
    current: createVec2(window.innerWidth / 2, window.innerHeight / 2),
    lerpAmount: 0.15,
  };
  private readonly updateCallback = (): void => this.update();
  private readonly pointerMoveHandler = (event: PointerEvent): void => {
    this.position.target.x = event.clientX;
    this.position.target.y = event.clientY;
  };
  private readonly pointerEnterHandler = (event: Event): void => {
    const target = (event.target as HTMLElement | null)?.closest(CURSOR_POINTER_SELECTOR);
    if (target instanceof HTMLElement) {
      this.cursorElement.classList.add('pointer-hover');
    }
  };
  private readonly pointerLeaveHandler = (event: Event): void => {
    const target = (event.target as HTMLElement | null)?.closest(CURSOR_POINTER_SELECTOR);
    if (target instanceof HTMLElement) {
      this.cursorElement.classList.remove('pointer-hover');
    }
  };

  constructor(cursorSelector: string) {
    const element = document.querySelector<HTMLElement>(cursorSelector);
    if (!element) {
      throw new Error(`InteractiveCursor: elemento não encontrado para o seletor "${cursorSelector}".`);
    }

    this.cursorElement = element;
    this.init();
  }

  private init(): void {
    gsap.set(this.cursorElement, { xPercent: -50, yPercent: -50 });
    gsap.ticker.add(this.updateCallback);
    document.addEventListener('pointermove', this.pointerMoveHandler);
    document.addEventListener('pointerenter', this.pointerEnterHandler, true);
    document.addEventListener('pointerleave', this.pointerLeaveHandler, true);
  }

  destroy(): void {
    document.removeEventListener('pointermove', this.pointerMoveHandler);
    document.removeEventListener('pointerenter', this.pointerEnterHandler, true);
    document.removeEventListener('pointerleave', this.pointerLeaveHandler, true);
    gsap.ticker.remove(this.updateCallback);
  }

  private update(): void {
    this.position.current.lerp(this.position.target, this.position.lerpAmount);
    gsap.set(this.cursorElement, {
      x: this.position.current.x,
      y: this.position.current.y,
    });
  }
}
