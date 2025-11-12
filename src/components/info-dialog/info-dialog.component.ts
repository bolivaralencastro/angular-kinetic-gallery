import { Component, ChangeDetectionStrategy, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-info-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed inset-0 z-[10001] flex flex-col backdrop-blur-md"
      [style.backgroundColor]="themeService.scrimColor()">
      <!-- Header with close button -->
      <div
        class="flex justify-between items-center p-6 border-b"
        [style.borderColor]="themeService.dialogPalette().border"
        [style.backgroundColor]="themeService.theme() === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(241,245,249,0.85)'">
        <h1
          class="text-lg font-medium uppercase"
          [style.color]="themeService.dialogPalette().title"
          style="letter-spacing: 0.2em;">SOBRE O PROJETO</h1>
        <button
          (click)="close.emit()"
          data-cursor-pointer
          class="text-2xl leading-none rounded-sm focus:outline-none"
          [style.color]="themeService.dialogPalette().icon"
          style="background: none; border: none; padding: 0; cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <span>&times;</span>
        </button>
      </div>

      <!-- Content in three columns -->
      <div
        class="flex-1 overflow-y-auto p-8"
        [style.color]="themeService.dialogPalette().text"
        [style.backgroundColor]="themeService.dialogPalette().surface"
      >
        <div class="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">

          <!-- Column 1: Apresentação -->
          <div class="space-y-4 max-w-xs">
            <h2
              class="text-sm font-medium uppercase mb-4"
              [style.color]="themeService.dialogPalette().title"
              style="letter-spacing: 0.15em;">Apresentação</h2>
            <div class="space-y-3 leading-relaxed" [style.color]="themeService.dialogPalette().text">
              <p>
                O Angular Kinetic Gallery é uma galeria de fotos interativa desenvolvida com Angular,
                oferecendo uma experiência única de navegação e visualização de imagens.
              </p>
              <p>
                Este projeto permite criar múltiplas galerias personalizadas, capturar fotos diretamente 
                da câmera do dispositivo, e organizar suas imagens em uma interface cinética e dinâmica.
              </p>
              <p>
                Todas as fotos são capturadas em formato quadrado (1:1) e convertidas automaticamente 
                para preto e branco, criando uma estética minimalista e elegante.
              </p>
              <p>
                Os dados são armazenados localmente no navegador, garantindo privacidade e acesso 
                rápido às suas galerias.
              </p>
            </div>
          </div>

          <!-- Column 2: Comandos -->
          <div class="space-y-4 max-w-xs">
            <h2
              class="text-sm font-medium uppercase mb-4"
              [style.color]="themeService.dialogPalette().title"
              style="letter-spacing: 0.15em;">Comandos e Atalhos</h2>
            <div class="space-y-4" [style.color]="themeService.dialogPalette().text">
              <div>
                <h3 class="text-sm font-medium mb-2" [style.color]="themeService.dialogPalette().title">Navegação</h3>
                <ul class="space-y-2 text-sm">
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">W</span> ou <span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">↑</span> - Mover para cima</li>
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">S</span> ou <span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">↓</span> - Mover para baixo</li>
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">A</span> ou <span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">←</span> - Mover para esquerda</li>
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">D</span> ou <span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">→</span> - Mover para direita</li>
                </ul>
              </div>

              <div>
                <h3 class="text-sm font-medium mb-2" [style.color]="themeService.dialogPalette().title">Ações</h3>
                <ul class="space-y-2 text-sm">
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">Espaço</span> - Criar galeria (na view de galerias) ou capturar foto (na view de fotos)</li>
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">T</span> - Alternar tema claro/escuro</li>
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">R</span> - Ativar/desativar timer na câmera</li>
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">F</span> - Alternar tela cheia</li>
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">ESC</span> - Fechar diálogos ou sair de tela cheia</li>
                  <li><span class="font-mono px-2 py-1 rounded" [style.backgroundColor]="themeService.dialogPalette().inputBackground" [style.color]="themeService.dialogPalette().inputText">I</span> - Abrir esta janela de informações</li>
                </ul>
              </div>

              <div>
                <h3 class="text-sm font-medium mb-2" [style.color]="themeService.dialogPalette().title">Mouse</h3>
                <ul class="space-y-2 text-sm">
                  <li>Clique direito - Abrir menu de contexto</li>
                  <li>Arrastar - Mover pela galeria (quando habilitado)</li>
                  <li>Clique em galeria - Visualizar fotos da galeria</li>
                  <li>Clique em foto - Expandir foto</li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Column 3: Autor -->
          <div class="space-y-4 max-w-xs">
            <h2
              class="text-sm font-medium uppercase mb-4"
              [style.color]="themeService.dialogPalette().title"
              style="letter-spacing: 0.15em;">Autor</h2>
            <div class="space-y-4" [style.color]="themeService.dialogPalette().text">
              <div>
                <p class="text-lg font-medium mb-2" [style.color]="themeService.dialogPalette().title">Bolívar Alencastro</p>
                <p class="text-sm mb-4">Product Designer</p>
              </div>

              <div>
              <a
                href="https://www.linkedin.com/in/bolivaralencastro/"
                target="_blank"
                rel="noopener noreferrer"
                data-cursor-pointer
                class="inline-flex items-center gap-2 transition-colors"
                [style.color]="themeService.dialogPalette().title"
                style="text-decoration: none;">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  <span>LinkedIn</span>
                </a>
              </div>

              <div class="pt-4 border-t" [style.borderColor]="themeService.dialogPalette().border">
                <p class="text-xs" [style.color]="themeService.dialogPalette().muted">
                  © 2024 Bolívar Alencastro. Todos os direitos reservados.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    button[style*="color"]:hover {
      filter: brightness(1.1);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoDialogComponent {
  close = output<void>();
  themeService = inject(ThemeService);
}

