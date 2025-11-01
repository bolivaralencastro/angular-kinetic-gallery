import { Component, ChangeDetectionStrategy, output, inject, signal, viewChild, ElementRef, AfterViewInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-webcam-capture',
  imports: [CommonModule],
  template: `
      <div 
      class="backdrop-blur-sm rounded-lg p-6 shadow-2xl w-full max-w-lg animate-slide-up relative"
      style="background-color: rgba(30, 30, 30, 0.95); border: 1px solid rgb(50, 50, 50);"
      (click)="$event.stopPropagation()">
      
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-medium text-gray-200 tracking-wider">Capturar Foto</h2>
        <button 
          (click)="close.emit()" 
          class="text-2xl leading-none rounded-sm focus:outline-none"
          style="color: rgb(180, 180, 180); background: none; border: none; padding: 0; cursor: pointer;">
          &times;
        </button>
      </div>
      
      @if (error()) {
        <div class="text-gray-300 px-3 py-2 rounded-lg text-sm mb-4" style="background-color: rgb(38, 38, 38); border: 1px solid rgb(70, 70, 70);">
          <p class="font-semibold">Erro ao acessar a câmera:</p>
          <p class="tracking-wider" style="color: rgb(180, 180, 180);">{{ error() }}</p>
        </div>
      }

      <!-- 1:1 aspect ratio container maintained throughout loading -->
      <div class="relative w-full aspect-square bg-black rounded-md overflow-hidden mb-4 vignette-effect">
        <div class="w-full h-full flex items-center justify-center">
          <!-- Loading state - always maintains the 1:1 aspect ratio -->
          @if (!isStreaming() && !error()) {
            <div class="absolute inset-0 flex items-center justify-center">
              <svg class="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
            <div class="absolute inset-0 flex items-center justify-center text-white text-9xl font-bold z-20">
              {{ countdown() }}
            </div>
          }
        </div>
      </div>

      <div class="flex items-center gap-4">
        <button 
          (click)="captureImage()"
          [disabled]="!isStreaming() || (countdown() !== null)"
          class="w-full text-white font-bold py-3 px-4 rounded-md transition-all duration-300 flex items-center justify-center h-12 tracking-wider text-sm focus:outline-none"
          [style.backgroundColor]="(!isStreaming() || countdown() !== null) ? 'rgb(38, 38, 38)' : 'rgb(60, 60, 60)'"
          [style.color]="(!isStreaming() || countdown() !== null) ? 'rgb(150, 150, 150)' : 'white'"
          [style.cursor]="(!isStreaming() || countdown() !== null) ? 'not-allowed' : 'pointer'"
          style="border: none;">
          <span>{{ isTimerEnabled() ? 'Iniciar Timer' : 'Tirar Foto' }}</span>
        </button>

        <button
          (click)="toggleTimer()"
          class="p-3 rounded-md text-gray-400 focus:outline-none"
          [style.backgroundColor]="isTimerEnabled() ? 'rgb(80, 80, 80)' : 'rgb(38, 38, 38)'"
          [style.color]="isTimerEnabled() ? 'white' : 'rgb(180, 180, 180)'"
          style="border: none;"
          title="Ativar/Desativar timer">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
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
      box-shadow: inset 0 0 40px 20px rgba(0, 0, 0, 0.8);
      z-index: 10;
    }

    button:not(:disabled):hover {
      background-color: rgb(80, 80, 80) !important;
    }

    button[style*="rgb(38, 38, 38)"]:not(:disabled):hover {
      background-color: rgb(80, 80, 80) !important;
    }

    button[style*="color: rgb(180, 180, 180)"]:hover {
      color: white !important;
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

  @HostListener('document:keydown.t', ['$event'])
  handleTKey(event: KeyboardEvent): void {
    event.preventDefault();
    this.toggleTimer();
  }

  close = output<void>();
  isStreaming = signal(false);
  error = signal<string | null>(null);
  isTimerEnabled = signal(false);
  countdown = signal<number | null>(null);

  videoElement = viewChild.required<ElementRef<HTMLVideoElement>>('videoElement');
  canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasElement');

  private galleryService = inject(GalleryService);
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

  private async startCamera(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('A API de mÃ­dia do navegador nÃ£o estÃ¡ disponÃ­vel.');
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      this.videoElement().nativeElement.srcObject = this.stream;
      this.isStreaming.set(true);
      this.error.set(null);
    } catch (err: any) {
      console.error("Erro ao iniciar a cÃ¢mera: ", err);
      let message = 'NÃ£o foi possÃ­vel acessar a cÃ¢mera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'A permissÃ£o para acessar a cÃ¢mera foi negada.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        message = 'Nenhuma cÃ¢mera foi encontrada no seu dispositivo.';
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
    }
    else {
      this.takePicture();
    }
  }

  private startCountdown(): void {
    this.countdown.set(3);
    this.countdownIntervalId = setInterval(() => {
      this.countdown.update(c => c! - 1);
      if (this.countdown() === 0) {
        clearInterval(this.countdownIntervalId);
        this.takePicture();
        this.countdown.set(null);
      }
    }, 1000);
  }

  private takePicture(): void {
    if (!this.isStreaming()) return;

    const video = this.videoElement().nativeElement;
    const canvas = this.canvasElement().nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (context) {
      // 1. Desenha a imagem original no canvas (que jÃ¡ estarÃ¡ em P&B por causa do filtro no vÃ­deo)
      // Para garantir a conversÃ£o correta, aplicamos o filtro aqui tambÃ©m.
      context.filter = 'grayscale(100%)';
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.filter = 'none'; // Reseta o filtro do contexto do canvas

      // 2. O filtro fotogrÃ¡fico via manipulaÃ§Ã£o de pixels nÃ£o Ã© mais estritamente necessÃ¡rio
      // se o filtro CSS for suficiente, mas mantÃª-lo garante a conversÃ£o no dado da imagem.
      this.applyPhotographicBWFilter(context, canvas.width, canvas.height);

      // 3. ObtÃ©m a URL da imagem processada
      const dataUrl = canvas.toDataURL('image/png');
      this.galleryService.addImage(dataUrl);
      this.close.emit();
    } else {
      this.error.set('NÃ£o foi possÃ­vel capturar a imagem.');
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
