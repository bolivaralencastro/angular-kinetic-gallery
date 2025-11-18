const CURSOR_POINTER_SELECTOR = '[data-cursor-pointer]';
const EDGE_THRESHOLD = 100; // pixels da borda para ativar setas

interface CursorPoint {
  x: number;
  y: number;
}

type EdgeDirection = 'none' | 'top' | 'right' | 'bottom' | 'left' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

export class InteractiveCursor {
  private readonly cursorElement: HTMLElement;
  private readonly position = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };
  private currentEdge: EdgeDirection = 'none';
  private readonly pointerMoveHandler = (event: PointerEvent): void => {
    this.position.x = event.clientX;
    this.position.y = event.clientY;
    this.updateCursorPosition();
    this.updateEdgeDetection();
  };
  private readonly pointerEnterHandler = (event: Event): void => {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) {
      return;
    }

    const target = eventTarget.closest(CURSOR_POINTER_SELECTOR);
    if (target instanceof HTMLElement) {
      this.cursorElement.classList.add('pointer-hover');
    }
  };
  private readonly pointerLeaveHandler = (event: Event): void => {
    const eventTarget = event.target;
    if (!(eventTarget instanceof Element)) {
      this.cursorElement.classList.remove('pointer-hover');
      return;
    }

    const target = eventTarget.closest(CURSOR_POINTER_SELECTOR);
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
    this.updateCursorPosition();
    document.addEventListener('pointermove', this.pointerMoveHandler);
    document.addEventListener('pointerenter', this.pointerEnterHandler, true);
    document.addEventListener('pointerleave', this.pointerLeaveHandler, true);
  }

  destroy(): void {
    document.removeEventListener('pointermove', this.pointerMoveHandler);
    document.removeEventListener('pointerenter', this.pointerEnterHandler, true);
    document.removeEventListener('pointerleave', this.pointerLeaveHandler, true);
  }

  private updateCursorPosition(): void {
    const { x, y } = this.position;
    this.cursorElement.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  private updateEdgeDetection(): void {
    const { x, y } = this.position;
    const width = window.innerWidth;
    const height = window.innerHeight;

    const isNearTop = y < EDGE_THRESHOLD;
    const isNearBottom = y > height - EDGE_THRESHOLD;
    const isNearLeft = x < EDGE_THRESHOLD;
    const isNearRight = x > width - EDGE_THRESHOLD;

    let newEdge: EdgeDirection = 'none';

    // Detectar cantos (diagonais) primeiro
    if (isNearTop && isNearLeft) {
      newEdge = 'top-left';
    } else if (isNearTop && isNearRight) {
      newEdge = 'top-right';
    } else if (isNearBottom && isNearLeft) {
      newEdge = 'bottom-left';
    } else if (isNearBottom && isNearRight) {
      newEdge = 'bottom-right';
    }
    // Detectar bordas
    else if (isNearTop) {
      newEdge = 'top';
    } else if (isNearBottom) {
      newEdge = 'bottom';
    } else if (isNearLeft) {
      newEdge = 'left';
    } else if (isNearRight) {
      newEdge = 'right';
    }

    if (newEdge !== this.currentEdge) {
      this.currentEdge = newEdge;
      this.applyEdgeCursor(newEdge);
    }
  }

  private applyEdgeCursor(edge: EdgeDirection): void {
    // Remover todas as classes de borda anteriores
    this.cursorElement.classList.remove(
      'edge-top',
      'edge-right',
      'edge-bottom',
      'edge-left',
      'edge-top-right',
      'edge-top-left',
      'edge-bottom-right',
      'edge-bottom-left'
    );

    // Adicionar classe correspondente
    if (edge !== 'none') {
      this.cursorElement.classList.add(`edge-${edge}`);
    }
  }

  isInEdgeZone(): boolean {
    return this.currentEdge !== 'none';
  }
}
