import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Gallery } from '../../interfaces/gallery.interface';

@Component({
  selector: 'app-mobile-gallery-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="group relative flex w-full items-center gap-4 rounded-3xl border border-slate-500/40 bg-white/5 p-4 transition hover:bg-white/10 focus-within:ring-2 focus-within:ring-white/30"
      [class.cursor-default]="!selectable()"
      [class.border-emerald-400/80]="showActiveIndicator() && active()"
      [class.ring-2]="showActiveIndicator() && active()"
      [class.ring-emerald-400/40]="showActiveIndicator() && active()"
      [class.bg-emerald-400/5]="showActiveIndicator() && active()"
      [attr.data-cursor-pointer]="selectable() ? '' : null"
      (click)="handleSelect($event)">
      <div class="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl border border-slate-500/40 bg-black/40">
        <img
          [src]="coverUrl()"
          class="h-full w-full object-cover"
          loading="lazy"
          [attr.alt]="'Prévia da galeria ' + gallery().name" />
      </div>
      <div class="min-w-0 flex-1">
        <h3 class="truncate text-base font-semibold text-white">{{ gallery().name }}</h3>
        <p class="mt-1 truncate text-xs text-gray-400">
          {{ gallery().description || 'Sem descrição' }}
        </p>
        <div class="mt-2 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-gray-500">
          @if (gallery().createdAt) {
            <span>{{ gallery().createdAt }}</span>
          }
          <span>{{ gallery().imageUrls.length }} fotos</span>
        </div>
      </div>
      <button
        type="button"
        class="rounded-full border border-white/20 p-3 text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
        [attr.aria-label]="viewLabel()"
        (click)="handleOpen($event)">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          class="h-5 w-5">
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M2.25 12s2.608-6.75 9.75-6.75 9.75 6.75 9.75 6.75-2.608 6.75-9.75 6.75S2.25 12 2.25 12Z" />
          <path
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileGalleryCardComponent {
  gallery = input.required<Gallery>();
  coverUrl = input.required<string>();
  active = input<boolean>(false);
  selectable = input<boolean>(true);
  showActiveIndicator = input<boolean>(true);
  viewLabel = input<string>('Abrir galeria');

  select = output<void>();
  open = output<void>();

  handleSelect(event: MouseEvent): void {
    if (!this.selectable()) {
      return;
    }

    event.stopPropagation();
    this.select.emit();
  }

  handleOpen(event: MouseEvent): void {
    event.stopPropagation();
    this.open.emit();
  }
}
