import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Gallery } from '../../interfaces/gallery.interface';

@Component({
  selector: 'app-mobile-gallery-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article
      class="card card--gallery"
      [class.is-selectable]="selectable()"
      [class.is-active]="showActiveIndicator() && active()"
      [attr.data-cursor-pointer]="selectable() ? '' : null"
      (click)="handleSelect($event)">
      <div class="card__avatar">
        <img
          [src]="coverUrl()"
          class="card__image"
          loading="lazy"
          [attr.alt]="'Prévia da galeria ' + gallery().name" />
      </div>
      <div class="card__content">
        <h3 class="card__title">{{ gallery().name }}</h3>
        <p class="card__description">
          {{ gallery().description || 'Sem descrição' }}
        </p>
        <div class="card__meta">
          @if (gallery().createdAt) {
            <span class="badge badge--mono card__badge">{{ formatCreatedAt(gallery().createdAt) }}</span>
          }
          <span class="badge badge--mono card__badge">{{ gallery().imageUrls.length }}</span>
        </div>
      </div>
      <button
        type="button"
        class="card__action"
        data-cursor-pointer
        [attr.aria-label]="viewLabel()"
        (click)="handleOpen($event)">
        <svg
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          class="card__action-icon"
          role="img"
        >
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
    </article>
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

  formatCreatedAt(value?: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const [day, month, year] = value.split('/');
    if (!day || !month || !year) {
      return value;
    }

    const shortYear = year.slice(-2);
    return `${day}/${month}/${shortYear}`;
  }
}
