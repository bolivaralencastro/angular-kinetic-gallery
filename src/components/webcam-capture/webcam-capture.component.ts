import { Component, ChangeDetectionStrategy, output, inject, signal, viewChild, ElementRef, AfterViewInit, OnDestroy, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from '../../services/gallery.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-webcam-capture',
  imports: [CommonModule],
  template: `
      <div 
      class="backdrop-blur-sm rounded-lg p-6 shadow-2xl w-full max-w-lg animate-slide-up relative"
      [style.backgroundColor]="themeService.dialogPalette().surface"
      [style.border]="'1px solid ' + themeService.dialogPalette().border"
      [style.color]="themeService.dialogPalette().text"
      [style.--dialog-focus-ring]="themeService.dialogPalette().focusRing"
      [style.--vignette-color]="themeService.isDark() ? 'rgba(0, 0, 0, 0.8)' : 'rgba(15, 23, 42, 0.35)'"
      (click)="$event.stopPropagation()">

      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-medium tracking-wider" [style.color]="themeService.dialogPalette().title">Capturar Foto</h2>
        <button
          (click)="close.emit()"
          data-cursor-pointer
          class="text-2xl leading-none rounded-sm focus:outline-none"
          [style.color]="themeService.dialogPalette().icon"
          style="background: none; border: none; padding: 0; cursor: pointer;">
          &times;
        </button>
      </div>

      @if (error()) {
        <div
          class="px-3 py-2 rounded-lg text-sm mb-4"
          [style.backgroundColor]="themeService.dialogPalette().inputBackground"
          [style.border]="'1px solid ' + themeService.dialogPalette().inputBorder"
          [style.color]="themeService.dialogPalette().text">
          <p class="font-semibold">Erro ao acessar a câmera:</p>
          <p class="tracking-wider" [style.color]="themeService.dialogPalette().muted">{{ error() }}</p>
        </div>
      }

      <!-- 1:1 aspect ratio container maintained throughout loading -->
      <div
        class="relative w-full aspect-square rounded-md overflow-hidden mb-4 vignette-effect"
        [style.backgroundColor]="themeService.isDark() ? '#000000' : '#e2e8f0'">
        <div class="w-full h-full flex items-center justify-center">
          <!-- Loading state - always maintains the 1:1 aspect ratio -->
          @if (!isStreaming() && !error()) {
            <div class="absolute inset-0 flex items-center justify-center">
              <svg
                class="animate-spin h-10 w-10"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                [attr.stroke]="themeService.dialogPalette().icon">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          }

          <!-- Video element - only shows when streaming -->
          <video #videoElement 
            class="w-full h-full object-cover grayscale" 
            [class.hidden]="!isStreaming()"
            autoplay 
            playsinline>
          </video>
          
          <!-- Countdown overlay - only shows during countdown -->
          @if (countdown() !== null && countdown()! > 0) {
            <div
              class="absolute inset-0 flex items-center justify-center text-9xl font-bold z-20"
              [style.color]="themeService.isDark() ? '#ffffff' : '#0f172a'">
              {{ countdown() }}
            </div>
          }
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <div class="flex items-center gap-4">
          <button
            (click)="captureImage()"
            [disabled]="!isStreaming() || (countdown() !== null)"
            data-cursor-pointer
            class="w-full font-bold py-3 px-4 rounded-md transition-all duration-300 flex items-center justify-center h-12 tracking-wider text-sm focus:outline-none"
            [style.backgroundColor]="(!isStreaming() || countdown() !== null) ? themeService.dialogPalette().disabledBg : themeService.dialogPalette().buttonPrimaryBg"
            [style.color]="(!isStreaming() || countdown() !== null) ? themeService.dialogPalette().disabledText : themeService.dialogPalette().buttonPrimaryText"
            [style.cursor]="(!isStreaming() || countdown() !== null) ? 'not-allowed' : 'pointer'"
            style="border: none;">
            <span>{{ isTimerEnabled() ? 'Iniciar Timer (' + timerDuration() + 's)' : 'Tirar Foto' }}</span>
          </button>

          <div class="flex items-center gap-2">
            <button
              (click)="toggleTimer()"
              data-cursor-pointer
              class="p-3 rounded-md focus:outline-none"
              [style.backgroundColor]="isTimerEnabled() ? themeService.dialogPalette().timerActiveBg : themeService.dialogPalette().timerInactiveBg"
              [style.color]="isTimerEnabled() ? themeService.dialogPalette().buttonPrimaryText : themeService.dialogPalette().timerInactiveText"
              style="border: none;"
              title="Ativar/Desativar timer">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>

            <button
              (click)="cycleTimerDuration()"
              data-cursor-pointer
              class="px-3 py-2 rounded-md text-sm font-semibold focus:outline-none transition-colors duration-200"
              [style.backgroundColor]="themeService.dialogPalette().inputBackground"
              [style.color]="themeService.dialogPalette().text"
              [style.border]="'1px solid ' + themeService.dialogPalette().inputBorder"
              title="Alternar duração do timer">
              {{ timerDuration() }}s
            </button>
          </div>
        </div>

        @if (availableCameras().length > 1) {
          <label class="flex flex-col gap-1 text-xs font-medium tracking-wider" [style.color]="themeService.dialogPalette().muted">
            Selecionar câmera
            <select
              class="rounded-md bg-transparent px-3 py-2 text-sm tracking-wider focus:outline-none"
              [style.color]="themeService.dialogPalette().text"
              [style.backgroundColor]="themeService.dialogPalette().inputBackground"
              [style.border]="'1px solid ' + themeService.dialogPalette().inputBorder"
              [value]="selectedCameraId() ?? ''"
              (change)="setCamera(($event.target as HTMLSelectElement).value)"
            >
              @for (camera of availableCameras(); track camera.deviceId; let index = $index) {
                <option [value]="camera.deviceId">{{ camera.label || 'Câmera ' + (index + 1) }}</option>
              }
            </select>
          </label>
        }
      </div>

      <canvas #canvasElement class="hidden"></canvas>
    </div>
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

  close = output<void>();
  isStreaming = signal(false);
  error = signal<string | null>(null);
  isTimerEnabled = signal(false);
  countdown = signal<number | null>(null);
  timerDurations = [3, 5, 10] as const;
  timerDurationIndex = signal(0);
  timerDuration = computed(() => this.timerDurations[this.timerDurationIndex()]);
  availableCameras = signal<MediaDeviceInfo[]>([]);
  selectedCameraId = signal<string | null>(null);

  videoElement = viewChild.required<ElementRef<HTMLVideoElement>>('videoElement');
  canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasElement');

  private galleryService = inject(GalleryService);
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

  toggleTimer(): void {
    this.isTimerEnabled.update(enabled => !enabled);
  }

  cycleTimerDuration(): void {
    this.timerDurationIndex.update(currentIndex => (currentIndex + 1) % this.timerDurations.length);
  }

  async setCamera(deviceId: string): Promise<void> {
    if (this.selectedCameraId() === deviceId) {
      return;
    }

    this.selectedCameraId.set(deviceId);
    await this.restartCamera();
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

      const constraints: MediaStreamConstraints = {
        video: this.selectedCameraId()
          ? { deviceId: { exact: this.selectedCameraId()! } }
          : { facingMode: 'environment' },
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
    if (!this.isStreaming() || this.countdown() !== null) return;

    if (this.isTimerEnabled()) {
      this.startCountdown();
    } else {
      this.takePicture();
    }
  }

  private startCountdown(): void {
    const duration = this.timerDuration();
    this.countdown.set(duration);
    this.countdownIntervalId = setInterval(() => {
      this.countdown.update(c => c! - 1);
      if (this.countdown() === 0) {
        clearInterval(this.countdownIntervalId);
        this.takePicture();
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

  private takePicture(): void {
    if (!this.isStreaming()) return;

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
    if (context) {
      // Draw only the central square portion of the video to the canvas
      // This ensures a perfect 1:1 aspect ratio without distortion
      context.filter = 'grayscale(100%)';
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
      context.filter = 'none'; // Reseta o filtro do contexto do canvas

      // Apply photographic BW filter
      this.applyPhotographicBWFilter(context, size, size);

      // Get the processed image URL
      const dataUrl = canvas.toDataURL('image/png');
      this.galleryService.addImage(dataUrl);
      this.close.emit();
    } else {
      this.error.set('Não foi possível capturar a imagem.');
    }
  }

  /**
   * Aplica um filtro de preto e branco fotogrÃ¡fico que preserva os detalhes.
   * @param context O contexto 2D do canvas.
   * @param width A largura da imagem.
   * @param height A altura da imagem.
   */
  private applyPhotographicBWFilter(context: CanvasRenderingContext2D, width: number, height: number): void {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data; // Array de pixels [R,G,B,A, R,G,B,A, ...]

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Converte para escala de cinza usando a fÃ³rmula de luminosidade (percepÃ§Ã£o humana)
      const grayscale = r * 0.299 + g * 0.587 + b * 0.114;
      
      data[i] = grayscale;     // Red
      data[i + 1] = grayscale; // Green
      data[i + 2] = grayscale; // Blue
      // O canal Alpha (data[i + 3]) permanece inalterado
    }
    
    // Coloca os dados da imagem modificada de volta no canvas
    context.putImageData(imageData, 0, 0);
  }
}
