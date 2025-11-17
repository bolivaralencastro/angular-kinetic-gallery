import { Component, ChangeDetectionStrategy, output, inject, signal, viewChild, ElementRef, AfterViewInit, OnDestroy, HostListener, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { convertToWebp } from '../../utils/convert-to-webp';

@Component({
  selector: 'app-webcam-capture',
  imports: [CommonModule],
  template: `
    @if (isMobileVariant()) {
      <div
        class="capture capture--mobile"
        [class.capture--active]="isCaptureActive()"
        [class.capture--framed]="showGrid()"
        [class.capture--countdown]="countdown() !== null && countdown()! > 0">
        <div class="capture__stage">
          <div class="capture__stage-inner">
            <div class="capture__viewport" data-cursor-pointer (click)="toggleGridOverlay()">
              <video
                #videoElement
                class="capture__video"
                [class.capture__video--hidden]="!isStreaming()"
                autoplay
                playsinline>
              </video>

              @if (!isStreaming() && !error()) {
                <div class="capture__status capture__status--loading">
                  Preparando câmera...
                </div>
              }

              @if (error()) {
                <div class="capture__status capture__status--error">
                  {{ error() }}
                </div>
              }

              <div class="capture__overlay-frame" aria-hidden="true"></div>

              @if (countdown() !== null && countdown()! > 0) {
                <div class="capture__countdown capture__countdown--mobile">
                  {{ countdown() }}
                </div>
              }
            </div>

            <div class="capture__gallery-slot">
              <ng-content select="[mobileGallerySelection]"></ng-content>
              <ng-content select="[gallerySelection]"></ng-content>
            </div>
          </div>
        </div>

        <div class="capture__panel">
          <div class="capture__control-board">
            <button
              type="button"
              (click)="cycleTimerSetting()"
              class="btn btn--ghost capture__chip"
              [disabled]="!isStreaming()">
              <span class="capture__chip-face">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capture__chip-icon">
                  <circle cx="12" cy="12" r="9"></circle>
                  <polyline points="12 7 12 12 15 13.5"></polyline>
                </svg>
              </span>
              <span class="capture__chip-label">{{ timerLabel() | uppercase }}</span>
            </button>

            <div class="capture__shutter-wrapper">
              <button
                type="button"
                (click)="captureImage()"
                class="capture__shutter"
                [disabled]="!isStreaming() || !captureAllowed() || isCaptureActive()">
                <span class="capture__shutter-layer capture__shutter-layer--frame"></span>
                <span class="capture__shutter-layer capture__shutter-layer--body"></span>
                <span class="capture__shutter-layer capture__shutter-layer--inner"></span>
                <span class="capture__shutter-layer capture__shutter-layer--core"></span>
                <span class="sr-only">Capturar foto</span>
              </button>
            </div>

            @if (availableCameras().length > 1) {
              <button
                type="button"
                (click)="cycleCamera()"
                class="btn btn--ghost capture__chip"
                [disabled]="!isStreaming()">
                <span class="capture__chip-face">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="capture__chip-icon">
                    <path d="M21 16.92A5.5 5.5 0 0 1 18.36 19H8"></path>
                    <path d="M3 12a5.5 5.5 0 0 1 5.5-5.5H16"></path>
                    <path d="M8 5l3-3 3 3"></path>
                    <path d="m16 19-3 3-3-3"></path>
                  </svg>
                </span>
                <span class="capture__chip-label">CÂMERA</span>
              </button>
            } @else {
              <div class="capture__control-placeholder" aria-hidden="true"></div>
            }
          </div>
        </div>

        <canvas
          #canvasElement
          class="capture__canvas"
          aria-hidden="true"></canvas>
      </div>
    } @else {
      <div
        class="capture capture--dialog capture-dialog animate-slide-up"
        [class.capture--active]="isCaptureActive()"
        [class.capture--countdown]="countdown() !== null && countdown()! > 0"
        [class.capture--framed]="showGrid()"
        [style.backgroundColor]="themeService.dialogPalette().surface"
        [style.border]="'1px solid ' + themeService.dialogPalette().border"
        [style.color]="themeService.dialogPalette().text"
        [style.--dialog-focus-ring]="themeService.dialogPalette().focusRing"
        [style.--vignette-color]="themeService.isDark() ? 'rgba(0, 0, 0, 0.8)' : 'rgba(15, 23, 42, 0.35)'"
        (click)="$event.stopPropagation()">

        <div class="capture-dialog__header">
          <h2 class="capture-dialog__title" [style.color]="themeService.dialogPalette().title">Capturar Foto</h2>
          <button
            type="button"
            (click)="close.emit()"
            data-cursor-pointer
            class="capture-dialog__close"
            [style.color]="themeService.dialogPalette().icon">
            &times;
          </button>
        </div>

        @if (error()) {
          <div
            class="capture-dialog__notice"
            [style.backgroundColor]="themeService.dialogPalette().inputBackground"
            [style.border]="'1px solid ' + themeService.dialogPalette().inputBorder"
            [style.color]="themeService.dialogPalette().text">
            <p class="capture-dialog__notice-title">Erro ao acessar a câmera:</p>
            <p class="capture-dialog__notice-text" [style.color]="themeService.dialogPalette().muted">{{ error() }}</p>
          </div>
        }

        <div
          class="capture-dialog__preview vignette-effect"
          [style.backgroundColor]="themeService.isDark() ? '#000000' : '#e2e8f0'">
          <div class="capture-dialog__preview-stage">
            @if (!isStreaming() && !error()) {
              <div class="capture-dialog__loading">
                <svg
                  class="capture-dialog__spinner"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  [attr.stroke]="themeService.dialogPalette().icon">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            }

            <video #videoElement
              class="capture-dialog__video"
              [class.capture-dialog__video--hidden]="!isStreaming()"
              autoplay
              playsinline>
            </video>

            @if (countdown() !== null && countdown()! > 0) {
              <div
                class="capture__countdown capture__countdown--dialog"
                [style.color]="themeService.isDark() ? '#ffffff' : '#0f172a'">
                {{ countdown() }}
              </div>
            }
          </div>
        </div>

        <div class="capture-dialog__gallery-slot">
          <ng-content select="[gallerySelection]"></ng-content>
        </div>

        <div class="capture-dialog__footer stack stack--loose">
          <div class="capture-dialog__primary-actions">
            <button
              type="button"
              (click)="captureImage()"
              [disabled]="!isStreaming() || (countdown() !== null)"
              data-cursor-pointer
              class="capture-dialog__primary-button button button--block"
              [style.backgroundColor]="(!isStreaming() || countdown() !== null) ? themeService.dialogPalette().disabledBg : themeService.dialogPalette().buttonPrimaryBg"
              [style.color]="(!isStreaming() || countdown() !== null) ? themeService.dialogPalette().disabledText : themeService.dialogPalette().buttonPrimaryText"
              [style.cursor]="(!isStreaming() || countdown() !== null) ? 'not-allowed' : 'pointer'"
              style="border: none;">
              <span>{{ isTimerEnabled() ? 'Iniciar Timer (' + timerDuration() + 's)' : 'Tirar Foto' }}</span>
            </button>

            <div class="capture-dialog__toggles">
              <button
                type="button"
                (click)="toggleTimer()"
                data-cursor-pointer
                class="capture-dialog__icon-button"
                [style.backgroundColor]="isTimerEnabled() ? themeService.dialogPalette().timerActiveBg : themeService.dialogPalette().timerInactiveBg"
                [style.color]="isTimerEnabled() ? themeService.dialogPalette().buttonPrimaryText : themeService.dialogPalette().timerInactiveText"
                style="border: none;"
                title="Ativar/Desativar timer">
                <svg xmlns="http://www.w3.org/2000/svg" class="capture-dialog__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              <button
                type="button"
                (click)="cycleTimerDuration()"
                data-cursor-pointer
                class="capture-dialog__secondary-button"
                [style.backgroundColor]="themeService.dialogPalette().inputBackground"
                [style.color]="themeService.dialogPalette().text"
                [style.border]="'1px solid ' + themeService.dialogPalette().inputBorder"
                title="Alternar duração do timer">
                {{ timerDuration() }}s
              </button>

              @if (availableCameras().length > 1) {
                <button
                  type="button"
                  (click)="cycleCamera()"
                  [disabled]="!isStreaming()"
                  data-cursor-pointer
                  class="capture-dialog__icon-button"
                  [style.backgroundColor]="isStreaming() ? themeService.dialogPalette().inputBackground : themeService.dialogPalette().disabledBg"
                  [style.border]="'1px solid ' + themeService.dialogPalette().inputBorder"
                  [style.color]="isStreaming() ? themeService.dialogPalette().text : themeService.dialogPalette().disabledText"
                  [style.cursor]="isStreaming() ? 'pointer' : 'not-allowed'"
                  title="Alternar câmera">
                  <svg xmlns="http://www.w3.org/2000/svg" class="capture-dialog__icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 8h.01M4.13 7.21a2 2 0 011.74-1.21h2.17l1.12-1.68A2 2 0 0111.86 3h.28a2 2 0 011.7 1l1.12 2h2.18a2 2 0 011.74 1.21l1.73 3.99a2 2 0 01-.08 1.77l-1.1 1.9M7 16l-2 3m0 0l-2-3m2 3v-5m5.22 5a4 4 0 007.18-2" />
                  </svg>
                </button>
              }
            </div>
          </div>
        </div>

        <canvas
          #canvasElement
          class="capture__canvas"
          aria-hidden="true"></canvas>
      </div>
    }
  `,
  styles: [`
    .animate-slide-up {
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .vignette-effect::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      box-shadow: inset 0 0 40px 20px var(--vignette-color, rgba(0, 0, 0, 0.8));
      z-index: 10;
    }

    button:not(:disabled):hover {
      filter: brightness(1.05);
    }

    .capture__canvas {
      display: none;
    }

    .capture-dialog__gallery-slot {
      margin-top: 12px;
    }

    .capture-dialog__selection-panel {
      display: grid;
      gap: 8px;
      border: 1px solid currentColor;
      border-radius: 12px;
      padding: 12px;
    }

    .capture-dialog__selection-header {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .capture-dialog__selection-title {
      font-weight: 600;
      margin: 0;
    }

    .capture-dialog__selection-hint {
      margin: 0;
      opacity: 0.8;
      font-size: 0.9rem;
    }

    .capture-dialog__selection-control {
      width: 100%;
      padding: 8px 10px;
      border-radius: 8px;
      border: 1px solid currentColor;
      background: transparent;
      color: inherit;
    }

    .capture-dialog__selection-empty {
      padding: 10px;
      border-radius: 8px;
      border: 1px dashed currentColor;
      font-size: 0.95rem;
    }

    .capture-dialog__selection-description {
      margin: 0;
      font-size: 0.95rem;
      opacity: 0.85;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebcamCaptureComponent implements AfterViewInit, OnDestroy {
  @HostListener('document:keydown.space', ['$event'])
  handleSpacebar(event: KeyboardEvent): void {
    event.preventDefault();
    this.captureImage();
  }

  @HostListener('document:keydown.r', ['$event'])
  handleTimerShortcut(event: KeyboardEvent): void {
    event.preventDefault();
    this.toggleTimer();
  }

  variant = input<'dialog' | 'mobile'>('dialog');
  close = output<void>();
  capture = output<string>();
  prepareCapture = output<void>();
  galleryChange = output<string>();
  gallerySelectionRequest = output<void>();
  captureAllowed = input(true);
  private capturing = signal(false);
  isStreaming = signal(false);
  error = signal<string | null>(null);
  isTimerEnabled = signal(false);
  countdown = signal<number | null>(null);
  timerDurations = [3, 5, 10] as const;
  timerDurationIndex = signal(0);
  timerDuration = computed(() => this.timerDurations[this.timerDurationIndex()]);
  timerLabel = computed(() => (this.isTimerEnabled() ? `${this.timerDuration()}s` : '0s'));
  availableCameras = signal<MediaDeviceInfo[]>([]);
  selectedCameraId = signal<string | null>(null);
  isMobileVariant = computed(() => this.variant() === 'mobile');
  showGrid = signal(false);
  isCaptureActive = computed(() => this.capturing() || this.countdown() !== null);

  videoElement = viewChild.required<ElementRef<HTMLVideoElement>>('videoElement');
  canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasElement');

  themeService = inject(ThemeService);
  private stream: MediaStream | null = null;
  private countdownIntervalId: any;

  ngAfterViewInit(): void {
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    if (this.countdownIntervalId) {
      clearInterval(this.countdownIntervalId);
    }
  }

  reloadApp(): void {
    window.location.reload();
  }

  notifyGalleryChange(galleryId: string): void {
    this.galleryChange.emit(galleryId);
  }

  requestGallerySelection(): void {
    this.gallerySelectionRequest.emit();
  }

  toggleTimer(): void {
    this.isTimerEnabled.update(enabled => !enabled);
  }

  cycleTimerDuration(): void {
    this.isTimerEnabled.set(true);
    this.timerDurationIndex.update(currentIndex => (currentIndex + 1) % this.timerDurations.length);
  }

  cycleTimerSetting(): void {
    if (!this.isTimerEnabled()) {
      this.isTimerEnabled.set(true);
      this.timerDurationIndex.set(0);
      return;
    }

    const nextIndex = this.timerDurationIndex() + 1;
    if (nextIndex >= this.timerDurations.length) {
      this.isTimerEnabled.set(false);
    } else {
      this.timerDurationIndex.set(nextIndex);
    }
  }

  async setCamera(deviceId: string): Promise<void> {
    if (this.selectedCameraId() === deviceId) {
      return;
    }

    this.selectedCameraId.set(deviceId);
    await this.restartCamera();
  }

  cycleCamera(): void {
    const cameras = this.availableCameras();
    if (cameras.length <= 1) {
      return;
    }

    const currentId = this.selectedCameraId();
    const currentIndex = currentId ? cameras.findIndex(camera => camera.deviceId === currentId) : -1;
    const nextIndex = (currentIndex + 1) % cameras.length;

    void this.setCamera(cameras[nextIndex].deviceId);
  }

  private async restartCamera(): Promise<void> {
    this.stopCamera();
    await this.startCamera();
  }

  private async startCamera(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('A API de mídia do navegador não está disponível.');
      }

      const commonVideoConstraints: MediaTrackConstraints = {
        aspectRatio: 1,
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      };

      const constraints: MediaStreamConstraints = {
        video: this.selectedCameraId()
          ? { ...commonVideoConstraints, deviceId: { exact: this.selectedCameraId()! } }
          : { ...commonVideoConstraints, facingMode: 'environment' },
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement().nativeElement.srcObject = this.stream;
      this.isStreaming.set(true);
      this.error.set(null);

      const [videoTrack] = this.stream.getVideoTracks();
      const activeDeviceId = videoTrack?.getSettings().deviceId;
      if (activeDeviceId) {
        this.selectedCameraId.set(activeDeviceId);
      }

      await this.loadAvailableCameras();
    } catch (err: any) {
      console.error('Erro ao iniciar a câmera: ', err);
      let message = 'Não foi possível acessar a câmera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'A permissão para acessar a câmera foi negada.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Nenhuma câmera foi encontrada no seu dispositivo.';
      }
      this.error.set(message);
      this.isStreaming.set(false);
    }
  }

  private stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    this.isStreaming.set(false);
  }

  captureImage(): void {
    if (!this.isStreaming() || !this.captureAllowed() || this.isCaptureActive()) {
      return;
    }

    this.capturing.set(true);
    this.prepareCapture.emit();

    const duration = this.isTimerEnabled() ? this.timerDuration() : 0;
    if (duration > 0) {
      this.startCountdown(duration);
    } else {
      void this.takePicture();
    }
  }

  private startCountdown(duration: number): void {
    this.countdown.set(duration);
    this.countdownIntervalId = setInterval(() => {
      this.countdown.update(c => c! - 1);
      if (this.countdown() === 0) {
        clearInterval(this.countdownIntervalId);
        void this.takePicture();
        this.countdown.set(null);
      }
    }, 1000);
  }

  private async loadAvailableCameras(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return;
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(device => device.kind === 'videoinput');
      this.availableCameras.set(videoInputs);

      if (videoInputs.length > 0 && !this.selectedCameraId()) {
        const preferredDevice = videoInputs.find(device => device.label.toLowerCase().includes('back')) ?? videoInputs[0];
        this.selectedCameraId.set(preferredDevice.deviceId);
      }
    } catch (err) {
      console.error('Erro ao carregar as câmeras disponíveis:', err);
    }
  }

  private async takePicture(): Promise<void> {
    if (!this.isStreaming()) {
      this.capturing.set(false);
      return;
    }

    try {
      const video = this.videoElement().nativeElement;
      const canvas = this.canvasElement().nativeElement;

      // Get video dimensions
      const videoWidth = video.videoWidth;
      const videoHeight = video.videoHeight;

      // Calculate the size for 1:1 aspect ratio (use the smaller dimension)
      const size = Math.min(videoWidth, videoHeight);

      // Set canvas to 1:1 aspect ratio
      canvas.width = size;
      canvas.height = size;

      // Calculate source crop position (center the crop)
      const sourceX = (videoWidth - size) / 2;
      const sourceY = (videoHeight - size) / 2;

      const context = canvas.getContext('2d');
      if (!context) {
        this.error.set('Não foi possível capturar a imagem.');
        return;
      }

      // Draw only the central square portion of the video to the canvas
      // This ensures a perfect 1:1 aspect ratio without distortion
      context.drawImage(
        video,
        sourceX,      // source x (crop from center)
        sourceY,      // source y (crop from center)
        size,         // source width (square)
        size,         // source height (square)
        0,            // destination x
        0,            // destination y
        size,         // destination width
        size          // destination height
      );

      const originalBlob = await this.canvasToBlob(canvas, 'image/png');
      if (!originalBlob) {
        this.error.set('Não foi possível capturar a imagem.');
        return;
      }

      const { blob } = await convertToWebp(originalBlob);

      try {
        const dataUrl = await this.blobToDataUrl(blob);
        this.capture.emit(dataUrl);
      } catch (error) {
        console.error('Erro ao gerar pré-visualização da captura', error);
        this.error.set('Não foi possível processar a imagem capturada.');
      }
    } catch (error) {
      console.error('Erro durante a captura da imagem', error);
      if (!this.error()) {
        this.error.set('Não foi possível capturar a imagem.');
      }
    } finally {
      this.capturing.set(false);
    }
  }

  private canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
    return new Promise(resolve => {
      canvas.toBlob(resolve, type);
    });
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string') {
          resolve(result);
        } else {
          reject(new Error('Resultado inesperado ao converter blob em Data URL.'));
        }
      };
      reader.onerror = () => {
        reject(new Error('Falha ao converter blob em Data URL.'));
      };
      reader.readAsDataURL(blob);
    });
  }

  toggleGridOverlay(): void {
    this.showGrid.update(value => !value);
  }
}
