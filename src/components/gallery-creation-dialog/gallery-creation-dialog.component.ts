import { Component, Output, EventEmitter, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-gallery-creation-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div
      class="fixed inset-0 flex justify-center items-center z-[10000]"
      data-cursor-pointer
      [style.backgroundColor]="themeService.scrimColor()"
      (click)="onClose()">
      <div
        class="backdrop-blur-sm rounded-lg p-6 shadow-2xl w-full max-w-lg animate-slide-up relative"
        [style.backgroundColor]="themeService.dialogPalette().surface"
        [style.border]="'1px solid ' + themeService.dialogPalette().border"
        [style.color]="themeService.dialogPalette().text"
        [style.--dialog-focus-ring]="themeService.dialogPalette().focusRing"
        (click)="$event.stopPropagation()">

        <div class="flex justify-between items-center mb-4">
          <h2
            class="text-xl font-medium tracking-wider"
            [style.color]="themeService.dialogPalette().title">
            Criar Galeria
          </h2>
          <button
            (click)="onClose()"
            data-cursor-pointer
            class="text-2xl leading-none rounded-sm focus:outline-none"
            [style.color]="themeService.dialogPalette().icon"
            style="background: none; border: none; padding: 0; cursor: pointer;">
            &times;
          </button>
        </div>

        <form [formGroup]="galleryForm" (ngSubmit)="onSubmit()">
          <div class="mb-4">
            <label
              for="name"
              class="block text-sm font-medium mb-2 tracking-wider"
              [style.color]="themeService.dialogPalette().muted">Nome</label>
            <input
              id="name"
              type="text"
              formControlName="name"
              class="w-full rounded-md py-3 px-4 focus:outline-none"
              [style.backgroundColor]="themeService.dialogPalette().inputBackground"
              [style.color]="themeService.dialogPalette().inputText"
              [style.border]="'1px solid ' + themeService.dialogPalette().inputBorder"
              style="outline: none;"
              placeholder="Digite o nome da galeria"
              required>
          </div>

          <div class="mb-6">
            <label
              for="description"
              class="block text-sm font-medium mb-2 tracking-wider"
              [style.color]="themeService.dialogPalette().muted">Descrição</label>
            <textarea
              id="description"
              formControlName="description"
              rows="3"
              class="w-full rounded-md py-3 px-4 focus:outline-none"
              [style.backgroundColor]="themeService.dialogPalette().inputBackground"
              [style.color]="themeService.dialogPalette().inputText"
              [style.border]="'1px solid ' + themeService.dialogPalette().inputBorder"
              style="outline: none;"
              placeholder="Digite a descrição da galeria"
              required>
            </textarea>
          </div>

          <div class="flex justify-end gap-3">
            <button
              type="button"
              (click)="onClose()"
              data-cursor-pointer
              class="px-6 py-2 font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none"
              [style.backgroundColor]="themeService.dialogPalette().buttonSecondaryBg"
              [style.color]="themeService.dialogPalette().buttonSecondaryText"
              style="border: none;">
              Cancelar
            </button>

            <button
              type="submit"
              [disabled]="galleryForm.invalid"
              data-cursor-pointer
              class="px-6 py-2 font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none"
              [style.backgroundColor]="galleryForm.invalid ? themeService.dialogPalette().disabledBg : themeService.dialogPalette().buttonPrimaryBg"
              [style.color]="galleryForm.invalid ? themeService.dialogPalette().disabledText : themeService.dialogPalette().buttonPrimaryText"
              [style.cursor]="galleryForm.invalid ? 'not-allowed' : 'pointer'"
              style="border: none;">
              Criar
            </button>
          </div>
        </form>
      </div>
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

    button:not(:disabled):hover {
      filter: brightness(1.05);
    }

    input:focus,
    textarea:focus {
      border-color: var(--dialog-focus-ring) !important;
      box-shadow: 0 0 0 2px var(--dialog-focus-ring) !important;
    }
  `],
})
export class GalleryCreationDialogComponent {
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ name: string, description: string }>();

  galleryForm: FormGroup;

  themeService = inject(ThemeService);

  constructor(private fb: FormBuilder) {
    this.galleryForm = this.fb.group({
      name: ['', Validators.required],
      description: ['']
    });
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
