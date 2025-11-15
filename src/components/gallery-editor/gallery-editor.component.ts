import { Component, ChangeDetectionStrategy, input, output, OnInit, inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Gallery } from '../../interfaces/gallery.interface';
import { ThemeService } from '../../services/theme.service';
import { cycleFocus, focusFirstElement } from '../../utils/focus-trap';

@Component({
  selector: 'app-gallery-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="modal"
      tabindex="-1"
      data-cursor-pointer
      [style.backgroundColor]="themeService.scrimColor()"
      (click)="close.emit()"
    >
      <article
        #panel
        class="modal__panel modal__panel--medium animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-editor-title"
        [style.--modal-surface]="themeService.dialogPalette().surface"
        [style.--modal-border]="themeService.dialogPalette().border"
        [style.--modal-text]="themeService.dialogPalette().text"
        [style.--modal-title]="themeService.dialogPalette().title"
        [style.--modal-muted]="themeService.dialogPalette().muted"
        [style.--modal-icon]="themeService.dialogPalette().icon"
        [style.--input-background]="themeService.dialogPalette().inputBackground"
        [style.--input-text]="themeService.dialogPalette().inputText"
        [style.--input-border]="themeService.dialogPalette().inputBorder"
        [style.--input-focus-ring]="themeService.dialogPalette().focusRing"
        [style.--btn-primary-bg]="themeService.dialogPalette().buttonPrimaryBg"
        [style.--btn-primary-text]="themeService.dialogPalette().buttonPrimaryText"
        [style.--btn-secondary-bg]="themeService.dialogPalette().buttonSecondaryBg"
        [style.--btn-secondary-text]="themeService.dialogPalette().buttonSecondaryText"
        (click)="$event.stopPropagation()"
        (keydown)="handleKeydown($event)"
      >
        <header class="modal__header">
          <h2 id="gallery-editor-title" class="modal__title">
            {{ gallery() ? 'Editar Galeria' : 'Criar Galeria' }}
          </h2>
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

        <form (ngSubmit)="onSubmit()">
          <section class="modal__body">
            <div class="form-field">
              <label for="name" class="form-label">Nome</label>
              <input
                #nameField
                id="name"
                type="text"
                [(ngModel)]="name"
                name="name"
                class="input"
                placeholder="Digite o nome da galeria"
                required
              />
            </div>

            <div class="form-field">
              <label for="description" class="form-label">Descrição</label>
              <textarea
                id="description"
                [(ngModel)]="description"
                name="description"
                rows="3"
                class="textarea"
                placeholder="Digite a descrição da galeria"
                required
              ></textarea>
            </div>
          </section>

          <footer class="modal__footer modal__footer--split">
            @if (gallery()) {
              <button
                type="button"
                (click)="onDelete()"
                data-cursor-pointer
                class="btn btn--danger"
              >
                Excluir
              </button>
            }

            <div class="modal__footer-group">
              <button
                type="button"
                (click)="close.emit()"
                data-cursor-pointer
                class="btn btn--secondary"
              >
                Cancelar
              </button>

              <button
                type="submit"
                data-cursor-pointer
                class="btn btn--primary"
              >
                {{ gallery() ? 'Atualizar' : 'Criar' }}
              </button>
            </div>
          </footer>
        </form>
      </article>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryEditorComponent implements OnInit, AfterViewInit {
  gallery = input<Gallery | null>(null);
  save = output<{ id: string | null; name: string; description: string }>();
  delete = output<string>();
  close = output<void>();

  name = '';
  description = '';

  themeService = inject(ThemeService);

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  @ViewChild('nameField') nameField?: ElementRef<HTMLInputElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  ngOnInit() {
    if (this.gallery()) {
      this.name = this.gallery()!.name;
      this.description = this.gallery()!.description;
    }
  }

  ngAfterViewInit(): void {
    const container = this.panel?.nativeElement;
    if (!container) {
      return;
    }

    focusFirstElement(container, this.nameField?.nativeElement ?? this.closeButton?.nativeElement ?? null);
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

  onSubmit() {
    this.save.emit({
      id: this.gallery()?.id || null,
      name: this.name,
      description: this.description
    });
  }

  onDelete() {
    if (this.gallery()) {
      this.delete.emit(this.gallery()!.id);
    }
  }
}