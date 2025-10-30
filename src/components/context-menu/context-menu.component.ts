import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-context-menu',
  imports: [CommonModule],
  template: `
    <div 
      class="fixed bg-black/80 backdrop-blur-sm border border-gray-800 text-gray-300 rounded-md shadow-lg p-1 z-50 animate-fade-in text-sm tracking-wider"
      [style.left.px]="x()"
      [style.top.px]="y()">
      <ul class="space-y-1" role="menu">
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
  
  close = output<void>();
  capture = output<void>();
  toggleFullscreen = output<void>();

  onCaptureClick(event: Event): void {
    event.stopPropagation();
    this.capture.emit();
  }
  
  onFullscreenClick(event: Event): void {
    event.stopPropagation();
    this.toggleFullscreen.emit();
  }
}