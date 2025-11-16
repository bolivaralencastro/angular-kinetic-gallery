import { Component, ChangeDetectionStrategy, output, inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { cycleFocus, focusFirstElement } from '../../utils/focus-trap';

@Component({
  selector: 'app-info-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="modal modal--stacked"
      tabindex="-1"
      data-cursor-pointer
      [style.backgroundColor]="themeService.scrimColor()"
    >
      <article
        #panel
        class="modal__panel modal__panel--full animate-slide-up info-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-dialog-title"
        [style.--modal-surface]="themeService.dialogPalette().surface"
        [style.--modal-border]="themeService.dialogPalette().border"
        [style.--modal-text]="themeService.dialogPalette().text"
        [style.--modal-title]="themeService.dialogPalette().title"
        [style.--modal-muted]="themeService.dialogPalette().muted"
        [style.--modal-icon]="themeService.dialogPalette().icon"
        [style.--badge-background]="themeService.dialogPalette().inputBackground"
        [style.--badge-text]="themeService.dialogPalette().inputText"
        [style.--modal-header-surface]="themeService.theme() === 'dark' ? 'rgba(0,0,0,0.3)' : 'rgba(241,245,249,0.85)'"
        (click)="$event.stopPropagation()"
        (keydown)="handleKeydown($event)"
      >
        <header class="modal__header modal__header--flush info-dialog__header">
          <h1 id="info-dialog-title" class="info-dialog__title">SOBRE O PROJETO</h1>
          <button
            #closeButton
            type="button"
            class="btn btn--ghost btn--icon modal__close"
            aria-label="Fechar"
            data-cursor-pointer
            (click)="close.emit()"
          >
            &times;
          </button>
        </header>

        <main class="modal__body modal__body--padded info-dialog__body">
          <div class="info-dialog__layout">
            <section class="info-dialog__column">
              <h2 class="info-dialog__section-title">Apresentação</h2>
              <div class="info-dialog__copy">
                <p>
                  O Angular Kinetic Gallery é uma galeria de fotos interativa desenvolvida com Angular,
                  oferecendo uma experiência única de navegação e visualização de imagens.
                </p>
                <p>
                  Este projeto permite criar múltiplas galerias personalizadas, capturar fotos diretamente
                  da câmera do dispositivo, e organizar suas imagens em uma interface cinética e dinâmica.
                </p>
                <p>
                  Os dados são armazenados localmente no navegador, garantindo privacidade e acesso
                  rápido às suas galerias.
                </p>
              </div>
            </section>

            <section class="info-dialog__column">
              <h2 class="info-dialog__section-title">Comandos e Atalhos</h2>
              <div class="info-dialog__stack">
                <div>
                  <h3 class="info-dialog__list-title">Navegação</h3>
                  <ul class="info-dialog__list">
                    <li><span class="badge badge--mono">↑</span> Mover para cima</li>
                    <li><span class="badge badge--mono">↓</span> Mover para baixo</li>
                    <li><span class="badge badge--mono">←</span> Mover para esquerda</li>
                    <li><span class="badge badge--mono">→</span> Mover para direita</li>
                  </ul>
                </div>

                <div>
                  <h3 class="info-dialog__list-title">Ações</h3>
                  <ul class="info-dialog__list">
                    <li><span class="badge badge--mono">Espaço</span> Criar galeria (na view de galerias) ou capturar foto (na view de fotos)</li>
                    <li><span class="badge badge--mono">T</span> Alternar tema claro/escuro</li>
                    <li><span class="badge badge--mono">R</span> Ativar/desativar timer na câmera</li>
                    <li><span class="badge badge--mono">F</span> Alternar tela cheia</li>
                    <li><span class="badge badge--mono">ESC</span> Fechar diálogos ou sair de tela cheia</li>
                    <li><span class="badge badge--mono">I</span> Abrir esta janela de informações</li>
                  </ul>
                </div>

                <div>
                  <h3 class="info-dialog__list-title">Mouse</h3>
                  <ul class="info-dialog__list">
                    <li>Clique direito - Abrir menu de contexto</li>
                    <li>Arrastar - Mover pela galeria (quando habilitado)</li>
                    <li>Clique em galeria - Visualizar fotos da galeria</li>
                    <li>Clique em foto - Expandir foto</li>
                  </ul>
                </div>
              </div>
            </section>

            <section class="info-dialog__column">
              <h2 class="info-dialog__section-title">Autor</h2>
              <div class="info-dialog__copy info-dialog__copy--stacked">
                <div>
                  <p class="info-dialog__highlight">Bolívar Alencastro</p>
                  <p class="info-dialog__muted">Product Designer</p>
                </div>

                <div>
                  <a
                    href="https://www.linkedin.com/in/bolivaralencastro/"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-cursor-pointer
                    class="info-dialog__link"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="info-dialog__icon" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    <span>LinkedIn</span>
                  </a>
                </div>

                <footer class="info-dialog__footer" [style.borderColor]="themeService.dialogPalette().border">
                  <p class="info-dialog__footnote" [style.color]="themeService.dialogPalette().muted">
                    © 2024 Bolívar Alencastro. Todos os direitos reservados.
                  </p>
                </footer>
              </div>
            </section>
          </div>
        </main>
      </article>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }

    .info-dialog__header {
      align-items: center;
    }

    .info-dialog__title {
      margin: 0;
      font-size: 1rem;
      font-weight: 600;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: var(--modal-title, var(--dialog-title));
    }

    .info-dialog__body {
      background-color: var(--modal-surface, var(--dialog-surface));
      color: var(--modal-text, var(--dialog-text));
    }

    .info-dialog__layout {
      display: grid;
      gap: 3rem;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      max-width: 80rem;
      margin: 0 auto;
    }

    .info-dialog__column {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
      max-width: 22rem;
    }

    .info-dialog__section-title {
      margin: 0;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--modal-title, var(--dialog-title));
    }

    .info-dialog__copy {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      line-height: 1.7;
      font-size: 0.95rem;
    }

    .info-dialog__copy--stacked {
      gap: 1.5rem;
    }

    .info-dialog__highlight {
      margin: 0 0 0.5rem 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: var(--modal-title, var(--dialog-title));
    }

    .info-dialog__muted {
      margin: 0;
      font-size: 0.85rem;
      color: var(--modal-muted, var(--dialog-muted));
    }

    .info-dialog__stack {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .info-dialog__list-title {
      margin: 0 0 0.75rem 0;
      font-size: 0.85rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--modal-title, var(--dialog-title));
    }

    .info-dialog__list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      font-size: 0.9rem;
    }

    .info-dialog__list .badge {
      margin-right: 0.75rem;
    }

    .info-dialog__link {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--modal-title, var(--dialog-title));
      text-decoration: none;
      transition: color 0.2s ease;
    }

    .info-dialog__link:hover {
      color: var(--modal-text, var(--dialog-text));
    }

    .info-dialog__icon {
      width: 1.25rem;
      height: 1.25rem;
    }

    .info-dialog__footer {
      margin-top: 1.5rem;
      padding-top: 1rem;
      border-top: 1px solid var(--modal-border, var(--dialog-border));
    }

    .info-dialog__footnote {
      margin: 0;
      font-size: 0.75rem;
    }

    @media (max-width: 768px) {
      .info-dialog__layout {
        gap: 2.25rem;
      }

      .info-dialog__column {
        max-width: none;
      }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoDialogComponent implements AfterViewInit {
  close = output<void>();
  themeService = inject(ThemeService);

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  ngAfterViewInit(): void {
    const container = this.panel?.nativeElement;
    if (!container) {
      return;
    }

    focusFirstElement(container, this.closeButton?.nativeElement ?? null);
  }

  handleKeydown(event: KeyboardEvent): void {
    const container = this.panel?.nativeElement;
    if (!container) {
      return;
    }

    if (cycleFocus(event, container)) {
      event.preventDefault();
    }
  }
}

