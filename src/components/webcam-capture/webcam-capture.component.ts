import { Component, ChangeDetectionStrategy, output, inject, signal, viewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GalleryService } from '../../services/gallery.service';

@Component({
  selector: 'app-webcam-capture',
  imports: [CommonModule],
  template: `
    <div 
      class="bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg p-6 shadow-2xl w-full max-w-lg animate-slide-up relative"
      (click)="$event.stopPropagation()">
      
      <div class="flex justify-between items-center mb-4">
        <h2 class="text-xl font-medium text-gray-200 tracking-wider">Capturar Foto</h2>
        <button 
          (click)="close.emit()" 
          class="text-gray-400 hover:text-white text-2xl leading-none rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500">
          &times;
        </button>
      </div>
      
      @if (error()) {
        <div class="bg-gray-800 border border-gray-600 text-gray-300 px-3 py-2 rounded-lg text-sm mb-4">
          <p class="font-semibold">Erro ao acessar a câmera:</p>
          <p class="tracking-wider text-gray-400">{{ error() }}</p>
        </div>
      }

      <div class="relative w-full aspect-square bg-black rounded-md overflow-hidden mb-4 vignette-effect">
        <video #videoElement 
          class="w-full h-full object-cover grayscale" 
          [class.hidden]="!isStreaming()"
          autoplay 
          playsinline>
        </video>
        @if (!isStreaming() && !error()) {
          <div class="absolute inset-0 flex items-center justify-center">
            <svg class="animate-spin h-10 w-10 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        }
      </div>

      <button 
        (click)="captureImage()"
        [disabled]="!isStreaming()"
        class="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-4 rounded-md transition-all duration-300 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed flex items-center justify-center h-12 tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500">
        <span>Tirar Foto</span>
      </button>

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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebcamCaptureComponent implements AfterViewInit, OnDestroy {
  close = output<void>();
  isStreaming = signal(false);
  error = signal<string | null>(null);

  videoElement = viewChild.required<ElementRef<HTMLVideoElement>>('videoElement');
  canvasElement = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasElement');

  private galleryService = inject(GalleryService);
  private stream: MediaStream | null = null;

  ngAfterViewInit(): void {
    this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private async startCamera(): Promise<void> {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('A API de mídia do navegador não está disponível.');
      }
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      this.videoElement().nativeElement.srcObject = this.stream;
      this.isStreaming.set(true);
      this.error.set(null);
    } catch (err: any) {
      console.error("Erro ao iniciar a câmera: ", err);
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
    if (!this.isStreaming()) return;

    const video = this.videoElement().nativeElement;
    const canvas = this.canvasElement().nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const context = canvas.getContext('2d');
    if (context) {
      // 1. Desenha a imagem original no canvas (que já estará em P&B por causa do filtro no vídeo)
      // Para garantir a conversão correta, aplicamos o filtro aqui também.
      context.filter = 'grayscale(100%)';
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      context.filter = 'none'; // Reseta o filtro do contexto do canvas

      // 2. O filtro fotográfico via manipulação de pixels não é mais estritamente necessário
      // se o filtro CSS for suficiente, mas mantê-lo garante a conversão no dado da imagem.
      this.applyPhotographicBWFilter(context, canvas.width, canvas.height);

      // 3. Obtém a URL da imagem processada
      const dataUrl = canvas.toDataURL('image/png');
      this.galleryService.addImage(dataUrl);
      this.close.emit();
    } else {
      this.error.set('Não foi possível capturar a imagem.');
    }
  }

  /**
   * Aplica um filtro de preto e branco fotográfico que preserva os detalhes.
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
      
      // Converte para escala de cinza usando a fórmula de luminosidade (percepção humana)
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
