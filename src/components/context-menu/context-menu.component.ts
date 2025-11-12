import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ContextMenuGroup, ContextMenuAction } from '../../types/context-menu';
import { ContextMenuPalette, ThemeMode } from '../../services/theme.service';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed backdrop-blur-sm rounded-md shadow-lg p-1 z-50 animate-fade-in text-sm tracking-wider min-w-[220px]"
      [style.backgroundColor]="themePalette().background"
      [style.borderColor]="themePalette().border"
      [style.color]="themePalette().text"
      [style.left.px]="x()"
      [style.top.px]="y()">
      <ul class="space-y-2" role="menu">
        @for (group of groups(); track group.label) {
          <li class="space-y-1" role="none">
            <p
              class="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.28em]"
              [style.color]="themePalette().heading">
              {{ group.label }}
            </p>
            <ul class="space-y-1" role="none">
              @for (action of group.actions; track action) {
                <li
                  role="menuitem"
                  tabindex="0"
                  data-cursor-pointer
                  class="px-3 py-1.5 rounded-md cursor-pointer flex items-center gap-2.5 focus:outline-none"
                  style="transition: background-color 0.2s;"
                  [style.backgroundColor]="hoveredAction() === action ? themePalette().itemHover : 'transparent'"
                  (mouseenter)="hoveredAction.set(action)"
                  (mouseleave)="hoveredAction.set(null)"
                  (focus)="hoveredAction.set(action)"
                  (blur)="hoveredAction.set(null)"
                  (click)="handleAction(action, $event)"
                  (keydown.enter)="handleAction(action, $event)">
                  <ng-container [ngSwitch]="action">
                    <ng-container *ngSwitchCase="'toggleTheme'">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" [attr.stroke]="themePalette().icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v1.5m0 15V21m9-9h-1.5M4.5 12H3m15.364 6.364-1.06-1.06M6.697 6.697 5.636 5.636m12.728 0-1.06 1.06M6.697 17.303l-1.061 1.061M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      <span>{{ themeMode() === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro' }}</span>
                    </ng-container>
                    <ng-container *ngSwitchCase="'togglePlayback'">
                      @if (isAutoNavigationActive()) {
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                          [attr.stroke]="themePalette().icon"
                        >
                          <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6h-3A1.5 1.5 0 0 0 6 7.5v9A1.5 1.5 0 0 0 7.5 18h3A1.5 1.5 0 0 0 12 16.5v-9A1.5 1.5 0 0 0 10.5 6Zm7.5 1.5v9A1.5 1.5 0 0 1 16.5 18h-3a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 13.5 6h3A1.5 1.5 0 0 1 18 7.5Z" />
                        </svg>
                        <span>Parar navegação automática</span>
                      } @else {
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          [attr.fill]="themePalette().icon"
                        >
                          <path d="M5.25 5.653c0-1.44 1.585-2.294 2.8-1.509l8.087 5.094a1.8 1.8 0 0 1 0 3.024L8.05 17.357c-1.215.785-2.8-.07-2.8-1.51V5.653Z" />
                        </svg>
                        <span>
                          @if (autoNavigationCountdown() !== null) {
                            Iniciar navegação automática ({{ autoNavigationCountdown() }}s)
                          } @else {
                            Iniciar navegação automática
                          }
                        </span>
                      }
                    </ng-container>
                    <ng-container *ngSwitchCase="'toggleFullscreen'">
                      @if (isFullscreen()) {
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" [attr.stroke]="themePalette().icon">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
                        </svg>
                        <span>Sair da tela cheia</span>
                      } @else {
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" [attr.stroke]="themePalette().icon">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                        <span>Entrar em tela cheia</span>
                      }
                    </ng-container>
                    <ng-container *ngSwitchCase="'info'">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" [attr.stroke]="themePalette().icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
                      </svg>
                      <span>Informações</span>
                    </ng-container>
                    <ng-container *ngSwitchCase="'createGallery'">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" [attr.stroke]="themePalette().icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span>Criar galeria</span>
                    </ng-container>
                    <ng-container *ngSwitchCase="'capturePhoto'">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" [attr.stroke]="themePalette().icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                      </svg>
                      <span>Tirar foto</span>
                    </ng-container>
                    <ng-container *ngSwitchCase="'editGallery'">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" [attr.stroke]="themePalette().icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14.125V21H4.875c-.621 0-1.125-.504-1.125-1.125V4.875c0-.621.504-1.125 1.125-1.125H12" />
                      </svg>
                      <span>Editar galeria</span>
                    </ng-container>
                    <ng-container *ngSwitchCase="'deleteGallery'">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" [attr.stroke]="themePalette().icon">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.107H7.218a2.25 2.25 0 01-2.244-2.107L4.74 5.836m19.825 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM12 4.5V3.75c0-.621-.504-1.125-1.125-1.125H9.75A1.125 1.125 0 008.625 3.75v.75m-8.1 4.5H12m-.75 0h-.75m.75 0h-.75M12 4.5H5.25m-1.5 0h-.75M4.5 4.5V2.25m0 0H2.25M2.25 2.25V4.5m0 0h-.75m.75 0v.75m0 0H2.25V4.5m-1.5 0h-.75M2.25 4.5V2.25M2.25 4.5h-.75m.75 0v.75m0 0H4.5m-.75 0V2.25M12 4.5h-.75m.75 0h-.75M12 4.5V3.75c0-.621-.504-1.125-1.125-1.125H9.75A1.125 1.125 0 008.625 3.75v.75m-8.1 4.5H12m-.75 0h-.75m.75 0h-.75Z" />
                      </svg>
                      <span>Excluir galeria</span>
                    </ng-container>
                  </ng-container>
                </li>
              }
            </ul>
            @if (!$last) {
              <div class="mx-2 h-px" [style.backgroundColor]="themePalette().divider"></div>
            }
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .animate-fade-in {
      animation: fadeIn 0.1s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    
    li[role="menuitem"]:focus {
      outline: none;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenuComponent {
  x = input.required<number>();
  y = input.required<number>();
  isFullscreen = input<boolean>(false);
  groups = input.required<ContextMenuGroup[]>();
  themePalette = input.required<ContextMenuPalette>();
  themeMode = input.required<ThemeMode>();
  isAutoNavigationActive = input<boolean>(false);
  autoNavigationCountdown = input<number | null>(null);

  hoveredAction = signal<ContextMenuAction | null>(null);

  close = output<void>();
  capture = output<void>();
  toggleFullscreen = output<void>();
  toggleTheme = output<void>();
  togglePlayback = output<void>();
  createGallery = output<void>();
  editGallery = output<void>();
  deleteGallery = output<void>();
  info = output<void>();

  handleAction(action: ContextMenuAction, event: Event): void {
    event.stopPropagation();

    switch (action) {
      case 'toggleTheme':
        this.toggleTheme.emit();
        break;
      case 'togglePlayback':
        this.togglePlayback.emit();
        break;
      case 'toggleFullscreen':
        this.toggleFullscreen.emit();
        break;
      case 'info':
        this.info.emit();
        break;
      case 'createGallery':
        this.createGallery.emit();
        break;
      case 'capturePhoto':
        this.capture.emit();
        break;
      case 'editGallery':
        this.editGallery.emit();
        break;
      case 'deleteGallery':
        this.deleteGallery.emit();
        break;
    }

    this.close.emit();
  }
}