import { Component, ChangeDetectionStrategy, signal, inject, computed, effect, viewChild, ElementRef, OnInit, AfterViewInit, OnDestroy, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from './services/gallery.service';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { WebcamCaptureComponent } from './components/webcam-capture/webcam-capture.component';
import { GalleryEditorComponent } from './components/gallery-editor/gallery-editor.component';


import { GalleryCreationDialogComponent } from './components/gallery-creation-dialog/gallery-creation-dialog.component';


import { Gallery } from './interfaces/gallery.interface';

// Interfaces para tipagem dos dados
interface BaseItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  col: number;
  row: number;
}

interface PhotoItem extends BaseItem {
  type: 'photo';
  url: string;
}

interface GalleryCardItem extends BaseItem {
  type: 'gallery';
  name: string;
  description: string;
  thumbnailUrl: string;
  imageCount: number;
  createdAt?: string;
}

type VisibleItem = PhotoItem | GalleryCardItem;

interface ExpandedItem {
  id: string;
  url:string;
  originalRect: DOMRect;
  originalWidth: number;
  originalHeight: number;
}

// DeclaraÃ§Ãµes para as bibliotecas globais do GSAP
declare const gsap: any;
declare const CustomEase: any;

@Component({
  selector: 'app-root',
  imports: [CommonModule, ContextMenuComponent, WebcamCaptureComponent, GalleryEditorComponent, GalleryCreationDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @HostListener('document:keydown.space', ['$event'])
  handleSpacebar(event?: KeyboardEvent | MouseEvent): void {
    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    if (!this.isWebcamVisible() && !this.expandedItem() && !this.isGalleryEditorVisible() && !this.isGalleryCreationDialogVisible()) {
      
      if (this.currentView() === 'galleries') {
        // Create a new gallery when in gallery view
        this.openGalleryCreationDialog();
      } else {
        // Open webcam when in photo view
        this.openWebcamCapture();
      }
    }
  }

  @HostListener('document:keydown.ArrowUp', ['$event'])
  @HostListener('document:keydown.w', ['$event'])
  moveUp(event: KeyboardEvent): void {
    if (this.canDrag()) {
      event.preventDefault();
      this.target.y += 50; // Adjust step size as needed
    }
  }

  @HostListener('document:keydown.ArrowDown', ['$event'])
  @HostListener('document:keydown.s', ['$event'])
  moveDown(event: KeyboardEvent): void {
    if (this.canDrag()) {
      event.preventDefault();
      this.target.y -= 50; // Adjust step size as needed
    }
  }

  @HostListener('document:keydown.ArrowLeft', ['$event'])
  @HostListener('document:keydown.a', ['$event'])
  moveLeft(event: KeyboardEvent): void {
    if (this.canDrag()) {
      event.preventDefault();
      this.target.x += 50; // Adjust step size as needed
    }
  }

  @HostListener('document:keydown.ArrowRight', ['$event'])
  @HostListener('document:keydown.d', ['$event'])
  moveRight(event: KeyboardEvent): void {
    if (this.canDrag()) {
      event.preventDefault();
      this.target.x -= 50; // Adjust step size as needed
    }
  }

  @HostListener('document:keydown.f', ['$event'])
  toggleFullscreenKey(event: KeyboardEvent): void {
    if (this.canDrag()) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleZoomKeys(event: KeyboardEvent): void {
    if (!this.canDrag()) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    }
  }

  galleryService = inject(GalleryService);
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef<HTMLElement>);

  // --- ConfiguraÃ§Ãµes da Galeria ---
  private numColumns = signal(4);
  private readonly ITEM_GAP = 32;
  private readonly settings = {
    dragEase: 0.075,
    momentumFactor: 200,
    bufferZone: 1.5,
    zoomDuration: 0.6,
  };

  // --- Sinais para o Estado da UI ---
  currentView = signal<'galleries' | 'photos'>('galleries'); // 'galleries' or 'photos'
  images = computed(() => this.galleryService.images());
  visibleItems = signal<VisibleItem[]>([]);
  expandedItem = signal<ExpandedItem | null>(null);
  isWebcamVisible = signal(false);
  contextMenu = signal<{ visible: boolean; x: number; y: number; options?: string[] }>({ visible: false, x: 0, y: 0 });
  isDragging = signal(false);
  
  isFullscreen = signal(false);
  private isViewInitialized = signal(false);

  // --- Sinais para o RelÃ³gio e Data ---
  currentTime = signal('');
  currentDate = signal('');
  private clockIntervalId: any;

  // --- Sinais para Contagem de Fotos e Galerias ---
  photoCount = computed(() => this.images().length);
  galleryCount = computed(() => this.galleryService.galleries().length);

  // --- Sinais para o Editor de Galeria ---
  isGalleryEditorVisible = signal(false);
  editingGallery = signal<Gallery | null>(null);
  isGalleryCreationDialogVisible = signal(false);

  // --- Sinais e Propriedades para o Modo Ocioso ---
  isIdle = signal(false);
  private inactivityTimeoutId: any;
  
  // --- Propriedades para o Context Menu ---
  private contextMenuGalleryId: string | null = null;
  
  canDrag = computed(() => !this.expandedItem() && !this.isWebcamVisible() && !this.isGalleryEditorVisible() && !this.isGalleryCreationDialogVisible());

  // --- ReferÃªncias a Elementos do Template ---
  private canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');
  private expandedItemElement = viewChild<ElementRef<HTMLDivElement>>('expandedItemElement');

  // --- Estado Privado para LÃ³gica de Arraste e AnimaÃ§Ã£o ---
  private itemDimensions = { width: 0, height: 0, cellWidth: 0, cellHeight: 0 };
  private target = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private velocity = { x: 0, y: 0 };
  private startDragPos = { x: 0, y: 0 };
  private lastDragTime = 0;
  private mouseHasMoved = false;
  
  // Touch positions for pinch detection
  private initialTouchDistance = 0;
  private lastTouchDistance = 0;
  
  private animationFrameId: number | null = null;
  private lastGridPosition = { x: -1, y: -1 };

  // --- Listeners de eventos vinculados para remoÃ§Ã£o correta ---
  private boundOnMouseMove: (event: MouseEvent) => void;
  private boundOnMouseUp: () => void;
  private boundOnTouchMove: (event: TouchEvent) => void;
  private boundOnTouchPinch: (event: TouchEvent) => void;
  private boundOnTouchEnd: () => void;
  private boundCloseContextMenu: (event: MouseEvent) => void;
  private boundOnFullscreenChange: () => void;
  private boundOnWheel: (event: WheelEvent) => void;

  constructor() {
    gsap.registerPlugin(CustomEase);
    CustomEase.create("hop", "0.9, 0, 0.1, 1");

    // Bind touch event handlers
    this.boundOnTouchMove = this.onTouchMove.bind(this);
    this.boundOnTouchPinch = this.onTouchPinch.bind(this);
    this.boundOnTouchEnd = this.onTouchEnd.bind(this);

    this.boundOnMouseMove = this.onMouseMove.bind(this);
    this.boundOnMouseUp = this.onMouseUp.bind(this);
    this.boundCloseContextMenu = this.closeContextMenu.bind(this);
    this.boundOnFullscreenChange = this.onFullscreenChange.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);

    effect(() => {
      if (!this.isViewInitialized()) return;
      // React to changes in currentView, images (selected gallery's photos), and galleries
      this.currentView();
      this.images();
      this.galleryService.galleries();
      this.updateVisibleItems(true);
    });

    effect(() => {
      const elementRef = this.expandedItemElement();
      const item = this.expandedItem();
      if (elementRef && item) {
        this.runExpandAnimation(elementRef.nativeElement, item);
      }
    });

    this.resetInactivityTimer();
  }

  ngOnInit(): void {
    this.startAnimationLoop();
    document.addEventListener('click', this.boundCloseContextMenu, true);
    document.addEventListener('fullscreenchange', this.boundOnFullscreenChange);
    this.elementRef.nativeElement.addEventListener('wheel', this.boundOnWheel, { passive: false });

    this.updateTime();
    this.updateDate();
    this.clockIntervalId = setInterval(() => this.updateTime(), 1000);
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
    this.elementRef.nativeElement.removeEventListener('wheel', this.boundOnWheel);

    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
    }
    clearTimeout(this.inactivityTimeoutId);
  }
  
  // --- LÃ³gica do Grid e AnimaÃ§Ã£o ---

  private resetInactivityTimer(): void {
    if (this.isIdle()) {
      this.isIdle.set(false);
    }
    clearTimeout(this.inactivityTimeoutId);
    this.inactivityTimeoutId = setTimeout(() => {
      this.isIdle.set(true);
    }, 5000);
  }
  
  private calculateGridDimensions(): void {
    const totalGapWidth = (this.numColumns() - 1) * this.ITEM_GAP;
    const containerWidth = this.elementRef.nativeElement.clientWidth;
    this.itemDimensions.width = (containerWidth - totalGapWidth) / this.numColumns();
    this.itemDimensions.height = this.itemDimensions.width;
    this.itemDimensions.cellWidth = this.itemDimensions.width + this.ITEM_GAP;
    this.itemDimensions.cellHeight = this.itemDimensions.height + this.ITEM_GAP;
  }

  private updateVisibleItems(force: boolean = false): void {
    let itemsToDisplay: (string | Gallery)[] = [];
    let isGalleryView = false;

    if (this.currentView() === 'galleries') {
      itemsToDisplay = this.galleryService.galleries();
      isGalleryView = true;
    } else {
      itemsToDisplay = this.images(); // This is already a computed signal from selected gallery
    }

    if (itemsToDisplay.length === 0) {
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

    const newVisibleItems: VisibleItem[] = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const itemIndex = Math.abs((row * this.numColumns() + col) % itemsToDisplay.length);
        const currentItem = itemsToDisplay[itemIndex];

        if (isGalleryView) {
          const gallery = currentItem as Gallery;
          newVisibleItems.push({
            type: 'gallery',
            id: gallery.id,
            name: gallery.name,
            description: gallery.description,
            thumbnailUrl: gallery.thumbnailUrl || 'https://via.placeholder.com/150?text=No+Image',
            imageCount: gallery.imageUrls.length,
            createdAt: gallery.createdAt,
            x: col * this.itemDimensions.cellWidth,
            y: row * this.itemDimensions.cellHeight,
            width: this.itemDimensions.width,
            height: this.itemDimensions.height,
            col,
            row,
          });
        } else {
          const imageUrl = currentItem as string;
          newVisibleItems.push({
            type: 'photo',
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
    }
    this.visibleItems.set(newVisibleItems);
  }

  private startAnimationLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        if (this.isIdle()) {
          const idleSpeed = 0.3;
          this.target.x -= idleSpeed;
          this.target.y -= idleSpeed;
        }

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

    editGallery(id: string): void {
    const galleryToEdit = this.galleryService.getGallery(id);
    if (galleryToEdit) {
      this.editingGallery.set(galleryToEdit);
      this.isGalleryEditorVisible.set(true);
    }
  }

  onResize(): void {
    this.calculateGridDimensions();
    this.updateVisibleItems(true);
    if(this.expandedItem()){
        this.closeExpandedItem();
    }
  }

  onWheel(event: WheelEvent): void {
    this.resetInactivityTimer();
    if (!this.canDrag()) return;
    event.preventDefault();
    
    if (event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  zoomIn(): void {
    this.numColumns.update(n => Math.max(1, n - 1));
    this.onResize();
  }

  zoomOut(): void {
    this.numColumns.update(n => Math.min(8, n + 1));
    this.onResize();
  }

  onMouseDown(event: MouseEvent): void {
    this.resetInactivityTimer();
    if (!this.canDrag() || event.button !== 0) return;
    this.isDragging.set(true);
    this.mouseHasMoved = false;
    this.startDragPos = { x: event.clientX, y: event.clientY };
    this.velocity = { x: 0, y: 0 };
    
    document.addEventListener('mousemove', this.boundOnMouseMove);
    document.addEventListener('mouseup', this.boundOnMouseUp, { once: true });
  }

  private onMouseMove(event: MouseEvent): void {
    this.resetInactivityTimer();
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

  onTouchStart(event: TouchEvent): void {
    this.resetInactivityTimer();
    if (!this.canDrag()) return;
    
    if (event.touches.length === 1) {
      // Single touch - drag
      this.isDragging.set(true);
      this.mouseHasMoved = false;
      this.startDragPos = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      this.velocity = { x: 0, y: 0 };
      
      document.addEventListener('touchmove', this.boundOnTouchMove as EventListener, { passive: false });
      document.addEventListener('touchend', this.boundOnTouchEnd as EventListener, { once: true });
    } else if (event.touches.length === 2) {
      // Two touches - pinch zoom
      this.isDragging.set(false); // Disable drag during pinch
      const touch1 = event.touches[0];
      const touch2 = event.touches[1];
      this.initialTouchDistance = this.getDistanceBetweenTouches(touch1, touch2);
      this.lastTouchDistance = this.initialTouchDistance;
      
      document.addEventListener('touchmove', this.boundOnTouchPinch as EventListener, { passive: false });
      document.addEventListener('touchend', this.boundOnTouchEnd as EventListener, { once: true });
    }
  }

  private getDistanceBetweenTouches(touch1: Touch, touch2: Touch): number {
    const deltaX = touch1.clientX - touch2.clientX;
    const deltaY = touch1.clientY - touch2.clientY;
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
  }

  private onTouchMove(event: TouchEvent): void {
    this.resetInactivityTimer();
    if (!this.isDragging()) return;
    const dx = event.touches[0].clientX - this.startDragPos.x;
    const dy = event.touches[0].clientY - this.startDragPos.y;
    
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
    this.startDragPos = { x: event.touches[0].clientX, y: event.touches[0].clientY };
  }

  private onTouchPinch(event: TouchEvent): void {
    if (event.touches.length < 2) return;
    
    const touch1 = event.touches[0];
    const touch2 = event.touches[1];
    const currentDistance = this.getDistanceBetweenTouches(touch1, touch2);
    
    // Calculate zoom factor based on distance change
    const scale = currentDistance / this.lastTouchDistance;
    
    // Determine zoom direction
    if (scale > 1.1) { // Zoom in (pinch out)
      this.zoomIn();
    } else if (scale < 0.9) { // Zoom out (pinch in)
      this.zoomOut();
    }
    
    this.lastTouchDistance = currentDistance;
  }

  private onTouchEnd(): void {
    this.isDragging.set(false);
    if (this.canDrag() && Math.hypot(this.velocity.x, this.velocity.y) > 0.1) {
      this.target.x += this.velocity.x * this.settings.momentumFactor;
      this.target.y += this.velocity.y * this.settings.momentumFactor;
    }
    document.removeEventListener('touchmove', this.boundOnTouchMove as EventListener);
    document.removeEventListener('touchmove', this.boundOnTouchPinch as EventListener);
  }

  // Add touch event binding to constructor
  onImageClick(event: MouseEvent, item: VisibleItem): void {
    if (this.mouseHasMoved || !this.canDrag()) return;

    if (item.type === 'gallery') {
      this.selectGallery(item.id);
    } else {
      this.expandItem(item, event.currentTarget as HTMLElement);
    }
  }



  expandItem(item: PhotoItem, element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.expandedItem.set({
      id: item.id,
      url: item.url,
      originalRect: rect,
      originalWidth: this.itemDimensions.width,
      originalHeight: this.itemDimensions.height,
    });
  }

  handleGalleryCreate(event: { name: string; description: string }): void {
    this.galleryService.createGallery(event.name, event.description);
    this.isGalleryCreationDialogVisible.set(false);
    this.updateVisibleItems(true); // Refresh the view
  }

  handleGallerySave(event: { id: string | null; name: string; description: string }): void {
    if (event.id) {
      this.galleryService.updateGallery(event.id, event.name, event.description);
    } else {
      this.galleryService.createGallery(event.name, event.description);
    }
    this.isGalleryEditorVisible.set(false);
    this.editingGallery.set(null);
    this.updateVisibleItems(true); // Refresh the view
  }

  handleGalleryDelete(id: string): void {
    this.galleryService.deleteGallery(id);
    this.isGalleryEditorVisible.set(false);
    this.editingGallery.set(null);
    this.updateVisibleItems(true); // Refresh the view
  }

  onRightClick(event: MouseEvent): void {
    event.preventDefault();
    if (this.currentView() === 'galleries') {
      this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY, options: ['createGallery'] });
    } else {
      this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY, options: ['capturePhoto'] });
    }
  }
  
  onGalleryRightClick(event: MouseEvent, galleryId: string): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.currentView() === 'galleries') {
      this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY, options: ['editGallery', 'deleteGallery'] });
      // Store the gallery ID for context menu actions
      this.contextMenuGalleryId = galleryId;
    }
  }

  closeContextMenu(): void {
    this.contextMenu.set({ visible: false, x: 0, y: 0 });
  }

  openWebcamCapture(): void {
    this.isWebcamVisible.set(true);
  }

  toggleFullscreen(): void {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  onFullscreenChange(): void {
    this.isFullscreen.set(!!document.fullscreenElement);
  }

  updateTime(): void {
    const now = new Date();
    this.currentTime.set(now.toLocaleTimeString('pt-BR'));
  }

  updateDate(): void {
    const now = new Date();
    this.currentDate.set(now.toLocaleDateString('pt-BR'));
  }

  selectGallery(id: string): void {
    this.galleryService.selectGallery(id);
    this.currentView.set('photos');
  }

  deleteGallery(id: string): void {
    this.galleryService.deleteGallery(id);
  }
  
  editGalleryContextMenu(): void {
    if (this.contextMenuGalleryId) {
      this.editGallery(this.contextMenuGalleryId);
    }
  }
  
  deleteGalleryContextMenu(): void {
    if (this.contextMenuGalleryId) {
      this.deleteGallery(this.contextMenuGalleryId);
    }
  }

  openGalleryCreationDialog(): void {
    this.isGalleryCreationDialogVisible.set(true);
  }

  createGalleryWithTimestamp(): void {
    // Create a gallery with current timestamp as the name in the expected format
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const timestamp = `${day}/${month}/${year} às ${hours}:${minutes}:${seconds}`;
    const galleryName = `Galeria ${timestamp}`;
    
    this.galleryService.createGallery(galleryName, 'Galeria criada automaticamente');
    this.updateVisibleItems(true); // Refresh the view
  }

  backToGalleries(): void {
    this.galleryService.selectGallery(null);
    this.currentView.set('galleries');
  }

  closeExpandedItem(): void {
    const element = this.expandedItemElement();
    if (element && this.expandedItem()) {
      const item = this.expandedItem()!;
      gsap.to(element.nativeElement, {
        width: item.originalWidth,
        height: item.originalHeight,
        x: item.originalRect.left + item.originalWidth / 2 - window.innerWidth / 2,
        y: item.originalRect.top + item.originalHeight / 2 - window.innerHeight / 2,
        duration: 0.6,
        ease: "hop",
        onComplete: () => {
          this.expandedItem.set(null);
        }
      });
    } else {
      this.expandedItem.set(null);
    }
  }



  openMobileAction(): void {
    if (this.currentView() === 'galleries') {
      // In galleries view - create a new gallery
      this.openGalleryCreationDialog();
    } else {
      // In photos view - open webcam capture
      this.openWebcamCapture();
    }
  }

  trackById(index: number, item: VisibleItem): string {
    return item.id;
  }
}