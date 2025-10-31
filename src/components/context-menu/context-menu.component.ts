import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="fixed bg-black/80 backdrop-blur-sm border border-gray-800 text-gray-300 rounded-md shadow-lg p-1 z-50 animate-fade-in text-sm tracking-wider"
      [style.left.px]="x()"
      [style.top.px]="y()">
      <ul class="space-y-1" role="menu">
        @for (option of options(); track option) {
          @if (option === 'createGallery') {
            <li 
              role="menuitem"
              tabindex="0"
              class="px-3 py-1.5 hover:bg-gray-800 rounded-md cursor-pointer flex items-center gap-2.5 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500"
              (click)="onCreateGalleryClick($event)"
              (keydown.enter)="onCreateGalleryClick($event)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Criar Nova Galeria</span>
            </li>
          } @else if (option === 'capturePhoto') {
            <li 
              role="menuitem"
              tabindex="0"
              class="px-3 py-1.5 hover:bg-gray-800 rounded-md cursor-pointer flex items-center gap-2.5 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500"
              (click)="onCaptureClick($event)"
              (keydown.enter)="onCaptureClick($event)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
              </svg>
              <span>Tirar Foto</span>
            </li>
          } @else if (option === 'editGallery') {
            <li 
              role="menuitem"
              tabindex="0"
              class="px-3 py-1.5 hover:bg-gray-800 rounded-md cursor-pointer flex items-center gap-2.5 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500"
              (click)="onEditGalleryClick($event)"
              (keydown.enter)="onEditGalleryClick($event)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14.125V21H4.875c-.621 0-1.125-.504-1.125-1.125V4.875c0-.621.504-1.125 1.125-1.125H12" />
              </svg>
              <span>Editar Galeria</span>
            </li>
          } @else if (option === 'deleteGallery') {
            <li 
              role="menuitem"
              tabindex="0"
              class="px-3 py-1.5 hover:bg-gray-800 rounded-md cursor-pointer flex items-center gap-2.5 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500"
              (click)="onDeleteGalleryClick($event)"
              (keydown.enter)="onDeleteGalleryClick($event)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.107H7.218a2.25 2.25 0 01-2.244-2.107L4.74 5.836m19.825 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM12 4.5V3.75c0-.621-.504-1.125-1.125-1.125H9.75A1.125 1.125 0 008.625 3.75v.75m-8.1 4.5H12m-.75 0h-.75m.75 0h-.75M12 4.5H5.25m-1.5 0h-.75M4.5 4.5V2.25m0 0H2.25M2.25 2.25V4.5m0 0h-.75m.75 0v.75m0 0H2.25V4.5m-1.5 0h-.75M2.25 4.5V2.25M2.25 4.5h-.75m.75 0v.75m0 0H4.5m-.75 0V2.25M12 4.5h-.75m.75 0h-.75M12 4.5V3.75c0-.621-.504-1.125-1.125-1.125H9.75A1.125 1.125 0 008.625 3.75v.75m-8.1 4.5H12m-.75 0h-.75m.75 0h-.75Z" />
              </svg>
              <span>Deletar Galeria</span>
            </li>
          }
        }
        <li
          role="menuitem"
          tabindex="0"
          class="px-3 py-1.5 hover:bg-gray-800 rounded-md cursor-pointer flex items-center gap-2.5 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500"
          (click)="onInfoClick($event)"
          (keydown.enter)="onInfoClick($event)">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
          </svg>
          <span>Informações</span>
        </li>
        <li
          role="menuitem"
          tabindex="0"
          class="px-3 py-1.5 hover:bg-gray-800 rounded-md cursor-pointer flex items-center gap-2.5 focus:outline-none focus:bg-gray-800 focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500"
          (click)="onFullscreenClick($event)"
          (keydown.enter)="onFullscreenClick($event)">
          @if(isFullscreen()) {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5M15 15l5.25 5.25" />
            </svg>
            <span>Sair da Tela Cheia</span>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9M20.25 20.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
            </svg>
            <span>Tela Cheia</span>
          }
        </li>
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
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContextMenuComponent {
  x = input.required<number>();
  y = input.required<number>();
  isFullscreen = input<boolean>(false);
  options = input<string[]>([]);
  
  close = output<void>();
  capture = output<void>();
  toggleFullscreen = output<void>();
  createGallery = output<void>();
  editGallery = output<void>();
  deleteGallery = output<void>();
  showInfo = output<void>();

  onCaptureClick(event: Event): void {
    event.stopPropagation();
    this.capture.emit();
  }

  onCreateGalleryClick(event: Event): void {
    event.stopPropagation();
    this.createGallery.emit();
  }

  onEditGalleryClick(event: Event): void {
    event.stopPropagation();
    this.editGallery.emit();
  }

  onDeleteGalleryClick(event: Event): void {
    event.stopPropagation();
    this.deleteGallery.emit();
  }
  
  onInfoClick(event: Event): void {
    event.stopPropagation();
    this.showInfo.emit();
  }
  
  onFullscreenClick(event: Event): void {
    event.stopPropagation();
    this.toggleFullscreen.emit();
  }
}