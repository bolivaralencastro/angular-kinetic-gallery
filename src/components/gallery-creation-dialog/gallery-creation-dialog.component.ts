import { Component, Output, EventEmitter, inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';
import { cycleFocus, focusFirstElement } from '../../utils/focus-trap';

@Component({
  selector: 'app-gallery-creation-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div
      class="modal"
      tabindex="-1"
      data-cursor-pointer
      [style.backgroundColor]="themeService.scrimColor()"
      (click)="onClose()"
    >
      <article
        #panel
        class="modal__panel modal__panel--medium animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="gallery-creation-title"
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
        [style.--btn-disabled-bg]="themeService.dialogPalette().disabledBg"
        [style.--btn-disabled-text]="themeService.dialogPalette().disabledText"
        (click)="$event.stopPropagation()"
        (keydown)="handleKeydown($event)"
      >
        <header class="modal__header">
          <h2 id="gallery-creation-title" class="modal__title">Criar Galeria</h2>
          <button
            #closeButton
            type="button"
            class="btn btn--ghost btn--icon modal__close"
            aria-label="Fechar"
            data-cursor-pointer
            (click)="onClose()"
          >
            &times;
          </button>
        </header>

        <form [formGroup]="galleryForm" (ngSubmit)="onSubmit()">
          <section class="modal__body">
            <div class="form-field">
              <label for="name" class="form-label">Nome</label>
              <input
                #nameField
                id="name"
                type="text"
                formControlName="name"
                class="input"
                placeholder="Digite o nome da galeria"
                required
              />
            </div>

            <div class="form-field">
              <label for="description" class="form-label">Descrição</label>
              <textarea
                id="description"
                formControlName="description"
                rows="3"
                class="textarea"
                placeholder="Digite a descrição da galeria"
                required
              ></textarea>
            </div>
          </section>

          <footer class="modal__footer">
            <button
              type="button"
              (click)="onClose()"
              data-cursor-pointer
              class="btn btn--secondary"
            >
              Cancelar
            </button>

            <button
              type="submit"
              [disabled]="galleryForm.invalid"
              data-cursor-pointer
              class="btn btn--primary"
            >
              Criar
            </button>
          </footer>
        </form>
      </article>
    </div>
  `,
})
export class GalleryCreationDialogComponent implements AfterViewInit {
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ name: string, description: string }>();

  galleryForm: FormGroup;

  themeService = inject(ThemeService);

  @ViewChild('panel') panel?: ElementRef<HTMLElement>;
  @ViewChild('nameField') nameField?: ElementRef<HTMLInputElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  constructor(private fb: FormBuilder) {
    this.galleryForm = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });
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
    if (this.galleryForm.valid) {
      this.save.emit(this.galleryForm.value);
      this.onClose();
    }
  }

  onClose() {
    this.close.emit();
  }
}
