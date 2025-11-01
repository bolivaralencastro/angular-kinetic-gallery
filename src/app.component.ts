import { Component, ChangeDetectionStrategy, signal, inject, computed, effect, viewChild, ElementRef, OnInit, AfterViewInit, OnDestroy, NgZone, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from './services/gallery.service';
import { ContextMenuComponent } from './components/context-menu/context-menu.component';
import { WebcamCaptureComponent } from './components/webcam-capture/webcam-capture.component';
import { GalleryEditorComponent } from './components/gallery-editor/gallery-editor.component';


import { GalleryCreationDialogComponent } from './components/gallery-creation-dialog/gallery-creation-dialog.component';
import { InfoDialogComponent } from './components/info-dialog/info-dialog.component';

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
  imports: [CommonModule, ContextMenuComponent, WebcamCaptureComponent, GalleryEditorComponent, GalleryCreationDialogComponent, InfoDialogComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  @HostListener('document:keydown.space', ['$event'])
  handleSpacebar(event?: KeyboardEvent | MouseEvent): void {
    if (event instanceof KeyboardEvent) {
      // Check if user is typing in an input field, textarea, or contenteditable element
      const target = event.target as HTMLElement;
      const isTyping = target && (
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' || 
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea')
      );
      
      if (isTyping) {
        // Allow space to be typed normally in input fields
        return;
      }
      
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

  @HostListener('document:keydown.f', ['$event'])
  toggleFullscreenKey(event: KeyboardEvent): void {
    // Check if user is typing in an input field, textarea, or contenteditable element
    const target = event.target as HTMLElement;
    const isTyping = target && (
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable ||
      target.closest('input') ||
      target.closest('textarea')
    );
    
    if (isTyping) {
      // Allow 'f' to be typed normally in input fields
      return;
    }
    
    // Allow fullscreen toggle when info dialog is visible or when can drag
    if (this.isInteractionEnabled() || this.isInfoDialogVisible()) {
      event.preventDefault();
      this.toggleFullscreen();
    }
  }

  @HostListener('document:keydown.i', ['$event'])
  handleIKey(event: KeyboardEvent): void {
    // Check if user is typing in an input field, textarea, or contenteditable element
    const target = event.target as HTMLElement;
    const isTyping = target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      target.closest('input') ||
      target.closest('textarea')
    );

    if (isTyping) {
      // Allow 'i' to be typed normally in input fields
      return;
    }

    event.preventDefault();
    // Toggle info dialog - if already open, it will close; if closed, it will open
    this.toggleInfoDialog();
  }

  @HostListener('document:keydown.q', ['$event'])
  handleQuitGalleryKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const isTyping = !!target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable ||
      !!target.closest('input') ||
      !!target.closest('textarea')
    );

    if (isTyping) {
      return;
    }

    if (
      this.currentView() === 'photos' &&
      !this.expandedItem() &&
      !this.isGalleryEditorVisible() &&
      !this.isGalleryCreationDialogVisible() &&
      !this.isWebcamVisible()
    ) {
      event.preventDefault();
      this.backToGalleries();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleZoomKeys(event: KeyboardEvent): void {
    if (!this.isInteractionEnabled()) return;

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleArrowNavigation(event: KeyboardEvent): void {
    if (!this.isInteractionEnabled()) {
      return;
    }

    const targetElement = event.target as HTMLElement | null;
    const isTyping = !!targetElement && (
      targetElement.tagName === 'INPUT' ||
      targetElement.tagName === 'TEXTAREA' ||
      targetElement.isContentEditable ||
      !!targetElement.closest('input') ||
      !!targetElement.closest('textarea')
    );

    if (isTyping) {
      return;
    }

    const { cellWidth, cellHeight } = this.itemDimensions;
    if (!cellWidth || !cellHeight) {
      return;
    }

    let deltaX = 0;
    let deltaY = 0;

    switch (event.key) {
      case 'ArrowUp':
        deltaY = cellHeight;
        break;
      case 'ArrowDown':
        deltaY = -cellHeight;
        break;
      case 'ArrowLeft':
        deltaX = cellWidth;
        break;
      case 'ArrowRight':
        deltaX = -cellWidth;
        break;
      default:
        return;
    }

    event.preventDefault();
    this.resetInactivityTimer();

    this.target.x += deltaX;
    this.target.y += deltaY;
    this.current.x += deltaX;
    this.current.y += deltaY;

    const canvasElement = this.canvas();
    if (canvasElement) {
      canvasElement.nativeElement.style.transform = `translate(${this.current.x}px, ${this.current.y}px)`;
    }

    this.updateVisibleItems(true);
  }

  galleryService = inject(GalleryService);
  private ngZone = inject(NgZone);
  private elementRef = inject(ElementRef<HTMLElement>);

  // --- ConfiguraÃ§Ãµes da Galeria ---
  private numColumns = signal(4);
  private readonly ITEM_GAP = 32;
  private readonly settings = {
    dragEase: 0.075,
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
  copiedGalleryId = signal<string | null>(null);
  isFullscreen = signal(false);
  private isViewInitialized = signal(false);

  // --- Sinais para o RelÃ³gio e Data ---
  currentTime = signal('');
  currentDate = signal('');
  private clockIntervalId: any;

  // --- Sinais para Contagem de Fotos e Galerias ---
  photoCount = computed(() => this.images().length);
  galleryCount = computed(() => this.galleryService.galleries().length);
  photoCounterLabel = computed(() => (this.photoCount() <= 1 ? "f.0" : "f's.00"));
  galleryCounterLabel = computed(() => (this.galleryCount() <= 1 ? "g.0" : "g's.00"));

  // --- Sinais para o Editor de Galeria ---
  isGalleryEditorVisible = signal(false);
  editingGallery = signal<Gallery | null>(null);
  isGalleryCreationDialogVisible = signal(false);
  isInfoDialogVisible = signal(false);

  // --- Sinais e Propriedades para o Modo Ocioso ---
  isIdle = signal(false);
  private inactivityTimeoutId: any;
  private idleEllipseAngle = 0;
  private idleEllipseCenter = { x: 0, y: 0 };
  private idleEllipseRadiusX = 0; // Semi-eixo maior (horizontal) - será calculado baseado na tela
  private idleEllipseRadiusY = 0; // Semi-eixo menor (vertical) - será calculado baseado na tela
  private readonly idleSpeed = 0.001; // Velocidade angular (reduzida para movimento mais lento)
  
  // --- Propriedades para o Context Menu ---
  private contextMenuGalleryId: string | null = null;
  private copyFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  
  isInteractionEnabled = computed(
    () =>
      !this.expandedItem() &&
      !this.isWebcamVisible() &&
      !this.isGalleryEditorVisible() &&
      !this.isGalleryCreationDialogVisible() &&
      !this.isInfoDialogVisible()
  );

  // --- ReferÃªncias a Elementos do Template ---
  private canvas = viewChild<ElementRef<HTMLDivElement>>('canvas');
  private expandedItemElement = viewChild<ElementRef<HTMLDivElement>>('expandedItemElement');

  // --- Estado Privado para LÃ³gica de AnimaÃ§Ã£o ---
  private itemDimensions = { width: 0, height: 0, cellWidth: 0, cellHeight: 0 };
  private target = { x: 0, y: 0 };
  private current = { x: 0, y: 0 };
  private viewport = { width: 0, height: 0 };
  private readonly EDGE_THRESHOLD = 150;
  private readonly MAX_SCROLL_SPEED = 25;
  private readonly interactionState: { isMouseOver: boolean; mouseX: number; mouseY: number } = {
    isMouseOver: false,
    mouseX: 0,
    mouseY: 0,
  };
  private animationFrameId: number | null = null;
  private lastGridPosition = { x: -1, y: -1 };

  // --- Listeners de eventos vinculados para remoÃ§Ã£o correta ---
  private boundCloseContextMenu: (event: MouseEvent) => void;
  private boundOnFullscreenChange: () => void;
  private boundOnWheel: (event: WheelEvent) => void;
  private boundOnMouseEnter: () => void;
  private boundOnMouseLeave: () => void;
  private boundOnMouseMove: (event: MouseEvent) => void;

  constructor() {
    gsap.registerPlugin(CustomEase);
    CustomEase.create("hop", "0.9, 0, 0.1, 1");

    this.boundCloseContextMenu = this.closeContextMenu.bind(this);
    this.boundOnFullscreenChange = this.onFullscreenChange.bind(this);
    this.boundOnWheel = this.onWheel.bind(this);
    this.boundOnMouseEnter = this.onMouseEnter.bind(this);
    this.boundOnMouseLeave = this.onMouseLeave.bind(this);
    this.boundOnMouseMove = this.onMouseMove.bind(this);

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

    const hostElement = this.elementRef.nativeElement;
    hostElement.addEventListener('mouseenter', this.boundOnMouseEnter);
    hostElement.addEventListener('mouseleave', this.boundOnMouseLeave);
    window.addEventListener('mousemove', this.boundOnMouseMove);
  }

  ngOnDestroy(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    document.removeEventListener('click', this.boundCloseContextMenu, true);
    document.removeEventListener('fullscreenchange', this.boundOnFullscreenChange);
    this.elementRef.nativeElement.removeEventListener('wheel', this.boundOnWheel);
    const hostElement = this.elementRef.nativeElement;
    hostElement.removeEventListener('mouseenter', this.boundOnMouseEnter);
    hostElement.removeEventListener('mouseleave', this.boundOnMouseLeave);
    window.removeEventListener('mousemove', this.boundOnMouseMove);

    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
    }
    clearTimeout(this.inactivityTimeoutId);
  }
  
  // --- LÃ³gica do Grid e AnimaÃ§Ã£o ---

  private resetInactivityTimer(): void {
    if (this.isIdle()) {
      this.isIdle.set(false);
      // Reseta o ângulo quando sai do modo idle
      this.idleEllipseAngle = 0;
    }
    clearTimeout(this.inactivityTimeoutId);
    this.inactivityTimeoutId = setTimeout(() => {
      // Calcula o tamanho da elipse baseado no tamanho da tela (4x maior)
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      this.idleEllipseRadiusX = screenWidth * 4; // 4x a largura da tela
      this.idleEllipseRadiusY = screenHeight * 4; // 4x a altura da tela
      
      // Define o centro da elipse baseado na posição atual quando entra em idle
      this.idleEllipseCenter.x = this.target.x;
      this.idleEllipseCenter.y = this.target.y;
      // Reseta o ângulo para começar do zero
      this.idleEllipseAngle = 0;
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
    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    this.viewport.width = rect.width;
    this.viewport.height = rect.height;
  }

  private onMouseEnter(): void {
    this.interactionState.isMouseOver = true;
    this.resetInactivityTimer();
  }

  private onMouseLeave(): void {
    this.interactionState.isMouseOver = false;
  }

  private onMouseMove(event: MouseEvent): void {
    if (!this.interactionState.isMouseOver) {
      return;
    }

    const rect = this.elementRef.nativeElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    const clampedX = Math.min(Math.max(relativeX, 0), rect.width);
    const clampedY = Math.min(Math.max(relativeY, 0), rect.height);

    this.interactionState.mouseX = clampedX;
    this.interactionState.mouseY = clampedY;
    this.resetInactivityTimer();
  }

  private calculateEdgeScroll(): { deltaX: number; deltaY: number } {
    if (!this.interactionState.isMouseOver) {
      return { deltaX: 0, deltaY: 0 };
    }

    const width = this.viewport.width;
    const height = this.viewport.height;

    if (width <= 0 || height <= 0) {
      return { deltaX: 0, deltaY: 0 };
    }

    const { mouseX, mouseY } = this.interactionState;
    let deltaX = 0;
    let deltaY = 0;

    if (mouseX < this.EDGE_THRESHOLD) {
      const intensity = Math.min(1, Math.max(0, 1 - mouseX / this.EDGE_THRESHOLD));
      deltaX = intensity * this.MAX_SCROLL_SPEED;
    } else if (mouseX > width - this.EDGE_THRESHOLD) {
      const distance = mouseX - (width - this.EDGE_THRESHOLD);
      const intensity = Math.min(1, Math.max(0, distance / this.EDGE_THRESHOLD));
      deltaX = -intensity * this.MAX_SCROLL_SPEED;
    }

    if (mouseY < this.EDGE_THRESHOLD) {
      const intensity = Math.min(1, Math.max(0, 1 - mouseY / this.EDGE_THRESHOLD));
      deltaY = intensity * this.MAX_SCROLL_SPEED;
    } else if (mouseY > height - this.EDGE_THRESHOLD) {
      const distance = mouseY - (height - this.EDGE_THRESHOLD);
      const intensity = Math.min(1, Math.max(0, distance / this.EDGE_THRESHOLD));
      deltaY = -intensity * this.MAX_SCROLL_SPEED;
    }

    return { deltaX, deltaY };
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
          // Atualiza o ângulo para percorrer a elipse
          this.idleEllipseAngle += this.idleSpeed;

          // Calcula a posição na elipse usando funções trigonométricas
          // x = centerX + radiusX * cos(angle)
          // y = centerY + radiusY * sin(angle)
          this.target.x = this.idleEllipseCenter.x + this.idleEllipseRadiusX * Math.cos(this.idleEllipseAngle);
          this.target.y = this.idleEllipseCenter.y + this.idleEllipseRadiusY * Math.sin(this.idleEllipseAngle);
        } else if (this.isInteractionEnabled()) {
          const { deltaX, deltaY } = this.calculateEdgeScroll();
          if (deltaX !== 0 || deltaY !== 0) {
            this.target.x += deltaX;
            this.target.y += deltaY;
          }
        }

        if (this.isInteractionEnabled()) {
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
    if (!this.isInteractionEnabled()) return;
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

  onImageClick(event: MouseEvent, item: VisibleItem): void {
    if (!this.isInteractionEnabled()) return;

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

  copyCampaignLink(event: MouseEvent, gallery: GalleryCardItem): void {
    event.preventDefault();
    event.stopPropagation();

    const campaignLink = this.buildCampaignUtmLink(gallery);

    if (!campaignLink) {
      console.warn('Unable to build the campaign link.');
      return;
    }

    if (!navigator?.clipboard) {
      console.warn('Clipboard API is not available in this environment.');
      this.copiedGalleryId.set(gallery.id);
      this.scheduleCopyFeedbackReset();
      return;
    }

    navigator.clipboard.writeText(campaignLink)
      .then(() => {
        this.copiedGalleryId.set(gallery.id);
        this.scheduleCopyFeedbackReset();
      })
      .catch(error => {
        console.error('Failed to copy campaign link', error);
      });
  }

  openGalleryMenuFromButton(event: MouseEvent, galleryId: string): void {
    event.preventDefault();
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement | null;
    const rect = target?.getBoundingClientRect();

    this.contextMenu.set({
      visible: true,
      x: rect ? rect.left : event.clientX,
      y: rect ? rect.bottom + 4 : event.clientY,
      options: ['editGallery', 'deleteGallery']
    });

    this.contextMenuGalleryId = galleryId;
  }

  onRightClick(event: MouseEvent): void {
    event.preventDefault();
    if (this.currentView() === 'galleries') {
      this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY, options: ['createGallery'] });
    } else {
      this.contextMenu.set({ visible: true, x: event.clientX, y: event.clientY, options: ['capturePhoto'] });
    }
  }

  private scheduleCopyFeedbackReset(): void {
    if (this.copyFeedbackTimeout) {
      clearTimeout(this.copyFeedbackTimeout);
    }

    this.copyFeedbackTimeout = setTimeout(() => {
      this.copiedGalleryId.set(null);
      this.copyFeedbackTimeout = null;
    }, 2000);
  }

  private buildCampaignUtmLink(gallery: GalleryCardItem): string {
    if (typeof window === 'undefined') {
      return '';
    }

    const url = new URL(window.location.href);
    url.hash = '';
    url.search = '';
    const campaignSlug = this.slugify(gallery.name) || gallery.id;

    url.searchParams.set('utm_source', 'gallery_app');
    url.searchParams.set('utm_medium', 'card_menu');
    url.searchParams.set('utm_campaign', campaignSlug);
    url.searchParams.set('campaignId', gallery.id);

    return url.toString();
  }

  private slugify(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
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

  toggleInfoDialog(): void {
    this.isInfoDialogVisible.update(visible => !visible);
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



  trackById(index: number, item: VisibleItem): string {
    return item.id;
  }
}