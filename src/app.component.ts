import { Component, ChangeDetectionStrategy, signal, inject, computed, effect, viewChild, ElementRef, OnInit, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from './services/gallery.service';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { WebcamCaptureComponent } from './components/webcam-capture/webcam-capture.component';

// Interfaces para tipagem dos dados
interface GalleryItem {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  col: number;
  row: number;
}

interface ExpandedItem {
  id: string;
  url:string;
  originalRect: DOMRect;
  originalWidth: number;
  originalHeight: number;
}

// Declarações para as bibliotecas globais do GSAP
declare const gsap: any;
declare const CustomEase: any;

@Component({
  selector: 'app-root',
  imports: [CommonModule, ContextMenuComponent, WebcamCaptureComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  galleryService = inject(GalleryService);
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef<HTMLElement>);

  // --- Configurações da Galeria ---
  private readonly NUM_COLUMNS = 4;
  private readonly ITEM_GAP = 32;
  private readonly settings = {
    dragEase: 0.075,
    momentumFactor: 200,
    bufferZone: 1.5,
    zoomDuration: 0.6,
  };

  // --- Sinais para o Estado da UI ---
  images = this.galleryService.images;
  visibleItems = signal<GalleryItem[]>([]);
  expandedItem = signal<ExpandedItem | null>(null);
  isWebcamVisible = signal(false);
  contextMenu = signal({ visible: false, x: 0, y: 0 });
  isDragging = signal(false);
  isFullscreen = signal(false);
  private isViewInitialized = signal(false);
  
  canDrag = computed(() => !this.expandedItem() && !this.isWebcamVisible());

  // --- Referências a Elementos do Template ---
  private canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');
  private expandedItemElement = viewChild<ElementRef<HTMLDivElement>>('expandedItemElement');

  // --- Estado Privado para Lógica de Arraste e Animação ---
  private itemDimensions = { width: 0, height: 0, cellWidth: 0, cellHeight: 0 };
  private target = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private velocity = { x: 0, y: 0 };
  private startDragPos = { x: 0, y: 0 };
  private lastDragTime = 0;
  private mouseHasMoved = false;
  private animationFrameId: number | null = null;
  private lastGridPosition = { x: -1, y: -1 };

  // --- Listeners de eventos vinculados para remoção correta ---
  private boundOnMouseMove: (event: MouseEvent) => void;
  private boundOnMouseUp: () => void;
  private boundCloseContextMenu: (event: MouseEvent) => void;
  private boundOnFullscreenChange: () => void;

  constructor() {
    gsap.registerPlugin(CustomEase);
    CustomEase.create("hop", "0.9, 0, 0.1, 1");

    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundCloseContextMenu = this.closeContextMenu.bind(this);
    this.boundOnFullscreenChange = this.onFullscreenChange.bind(this);

    effect(() => {
      if (!this.isViewInitialized()) return;
      this.images();
      this.updateVisibleItems(true);
    });

    effect(() => {
      const elementRef = this.expandedItemElement();
      const item = this.expandedItem();
      if (elementRef && item) {
        this.runExpandAnimation(elementRef.nativeElement, item);
      }
    });
  }

  ngOnInit(): void {
    this.startAnimationLoop();
    document.addEventListener('click', this.boundCloseContextMenu, true);
    document.addEventListener('fullscreenchange', this.boundOnFullscreenChange);
  }

  ngAfterViewInit(): void {
    this.onResize();
    this.isViewInitialized.set(true);
    const resizeObserver = new ResizeObserver(() => this.onResize());
    resizeObserver.observe(this.elementRef.nativeElement);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    document.removeEventListener('click', this.boundCloseContextMenu, true);
    document.removeEventListener('fullscreenchange', this.boundOnFullscreenChange);
    document.removeEventListener('mousemove', this.boundOnMouseMove);
    document.removeEventListener('mouseup', this.boundOnMouseUp);
  }
  
  // --- Lógica do Grid e Animação ---
  
  private calculateGridDimensions(): void {
    const totalGapWidth = (this.NUM_COLUMNS - 1) * this.ITEM_GAP;
    const containerWidth = this.elementRef.nativeElement.clientWidth;
    this.itemDimensions.width = (containerWidth - totalGapWidth) / this.NUM_COLUMNS;
    this.itemDimensions.height = this.itemDimensions.width;
    this.itemDimensions.cellWidth = this.itemDimensions.width + this.ITEM_GAP;
    this.itemDimensions.cellHeight = this.itemDimensions.height + this.ITEM_GAP;
  }

  private updateVisibleItems(force: boolean = false): void {
    if (this.images().length === 0) {
        this.visibleItems.set([]);
        return;
    }

    const newGridPosition = {
        x: Math.round(this.current.x / 100),
        y: Math.round(this.current.y / 100),
    };

    if (!force && this.lastGridPosition.x === newGridPosition.x && this.lastGridPosition.y === newGridPosition.y) {
        return;
    }
    this.lastGridPosition = newGridPosition;
    
    const viewWidth = this.elementRef.nativeElement.clientWidth;
    const viewHeight = this.elementRef.nativeElement.clientHeight;

    const startCol = Math.floor((-this.current.x) / this.itemDimensions.cellWidth - this.settings.bufferZone);
    const endCol = Math.ceil((-this.current.x + viewWidth) / this.itemDimensions.cellWidth + this.settings.bufferZone);
    const startRow = Math.floor((-this.current.y) / this.itemDimensions.cellHeight - this.settings.bufferZone);
    const endRow = Math.ceil((-this.current.y + viewHeight) / this.itemDimensions.cellHeight + this.settings.bufferZone);

    const newVisibleItems: GalleryItem[] = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const itemNum = Math.abs((row * this.NUM_COLUMNS + col) % this.images().length);
        const imageUrl = this.images()[itemNum];
        
        newVisibleItems.push({
          id: `${col},${row}`,
          url: imageUrl,
          x: col * this.itemDimensions.cellWidth,
          y: row * this.itemDimensions.cellHeight,
          width: this.itemDimensions.width,
          height: this.itemDimensions.height,
          col,
          row,
        });
      }
    }
    this.visibleItems.set(newVisibleItems);
  }

  private startAnimationLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        if (this.canDrag()) {
          this.current.x += (this.target.x - this.current.x) * this.settings.dragEase;
          this.current.y += (this.target.y - this.current.y) * this.settings.dragEase;
          
          if (this.canvas()) {
            this.canvas()!.nativeElement.style.transform = `translate(${this.current.x}px, ${this.current.y}px)`;
          }

          this.updateVisibleItems();
        }
        this.animationFrameId = requestAnimationFrame(animate);
      };
      animate();
    });
  }

  private runExpandAnimation(element: HTMLElement, item: ExpandedItem): void {
    const side = Math.min(window.innerWidth, window.innerHeight) * 0.9;
    
    gsap.fromTo(element, {
      width: item.originalWidth,
      height: item.originalHeight,
      x: item.originalRect.left + item.originalWidth / 2 - window.innerWidth / 2,
      y: item.originalRect.top + item.originalHeight / 2 - window.innerHeight / 2,
    }, {
      width: side,
      height: side,
      x: 0,
      y: 0,
      duration: this.settings.zoomDuration,
      ease: "hop",
    });
  }

  // --- Handlers de Eventos ---

  onResize(): void {
    this.calculateGridDimensions();
    this.updateVisibleItems(true);
    if(this.expandedItem()){
        this.closeExpandedItem();
    }
  }

  onMouseDown(event: MouseEvent): void {
    if (!this.canDrag() || event.button !== 0) return;
    this.isDragging.set(true);
    this.mouseHasMoved = false;
    this.startDragPos = { x: event.clientX, y: event.clientY };
    this.velocity = { x: 0, y: 0 };
    
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp, { once: true });
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.isDragging()) return;
    const dx = event.clientX - this.startDragPos.x;
    const dy = event.clientY - this.startDragPos.y;
    
    if (!this.mouseHasMoved && Math.hypot(dx, dy) > 5) {
      this.mouseHasMoved = true;
    }

    const now = Date.now();
    const dt = Math.max(10, now - this.lastDragTime);
    this.lastDragTime = now;
    this.velocity.x = dx / dt;
    this.velocity.y = dy / dt;
    
    this.target.x += dx;
    this.target.y += dy;
    this.startDragPos = { x: event.clientX, y: event.clientY };
  }

  private onMouseUp(): void {
    this.isDragging.set(false);
    if (this.canDrag() && Math.hypot(this.velocity.x, this.velocity.y) > 0.1) {
      this.target.x += this.velocity.x * this.settings.momentumFactor;
      this.target.y += this.velocity.y * this.settings.momentumFactor;
    }
    document.removeEventListener('mousemove', this.boundOnMouseMove);
  }

  onImageClick(event: MouseEvent, item: GalleryItem): void {
    if (this.mouseHasMoved || !this.canDrag()) return;
    this.expandItem(item, event.currentTarget as HTMLElement);
  }

  onLikeClicked(event: MouseEvent, item: GalleryItem): void {
    event.stopImmediatePropagation();
    console.log(`Liked item: ${item.id}`);
  }

  expandItem(item: GalleryItem, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.expandedItem.set({
      id: item.id,
      url: item.url,
      originalRect: rect,
      originalWidth: this.itemDimensions.width,
      originalHeight: this.itemDimensions.height,
    });
  }

  closeExpandedItem(): void {
    const item = this.expandedItem();
    const element = this.expandedItemElement()?.nativeElement;
    if (!item || !element) return;

    gsap.to(element, {
      width: item.originalWidth,
      height: item.originalHeight,
      x: item.originalRect.left + item.originalWidth / 2 - window.innerWidth / 2,
      y: item.originalRect.top + item.originalHeight / 2 - window.innerHeight / 2,
      duration: this.settings.zoomDuration,
      ease: "hop",
      onComplete: () => {
        this.expandedItem.set(null);
      },
    });
  }

  onRightClick(event: MouseEvent): void {
    event.preventDefault();
    this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY });
  }

  closeContextMenu(): void {
    this.contextMenu.set({ visible: false, x: 0, y: 0 });
  }

  openWebcamCapture(): void {
    this.isWebcamVisible.set(true);
    this.closeContextMenu();
  }

  toggleFullscreen(): void {
    this.closeContextMenu();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
  
  private onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  trackById(index: number, item: GalleryItem): string {
    return item.id;
  }
}