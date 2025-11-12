import { Component, ChangeDetectionStrategy, input, output, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Gallery } from '../../interfaces/gallery.interface';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-gallery-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="fixed inset-0 flex justify-center items-center z-[10000]"
      data-cursor-pointer
      [style.backgroundColor]="themeService.scrimColor()"
      (click)="close.emit()">
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
            {{ gallery() ? 'Editar Galeria' : 'Criar Galeria' }}
          </h2>
          <button
            (click)="close.emit()"
            data-cursor-pointer
            class="text-2xl leading-none rounded-sm focus:outline-none"
            [style.color]="themeService.dialogPalette().icon"
            style="background: none; border: none; padding: 0; cursor: pointer;">
            &times;
          </button>
        </div>

        <form (ngSubmit)="onSubmit()">
          <div class="mb-4">
            <label
              for="name"
              class="block text-sm font-medium mb-2 tracking-wider"
              [style.color]="themeService.dialogPalette().muted">Nome</label>
            <input
              id="name"
              type="text"
              [(ngModel)]="name"
              name="name"
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
              [(ngModel)]="description"
              name="description"
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

          <div class="flex justify-between items-center">
            @if (gallery()) {
              <button
                type="button"
                (click)="onDelete()"
                data-cursor-pointer
                class="px-4 py-2 font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none"
                style="background-color: rgb(150, 40, 40); border: none; color: #fff;">
                Excluir
              </button>
            }

            <div class="flex gap-3 ml-auto">
              <button
                type="button"
                (click)="close.emit()"
                data-cursor-pointer
                class="px-6 py-2 font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none"
                [style.backgroundColor]="themeService.dialogPalette().buttonSecondaryBg"
                [style.color]="themeService.dialogPalette().buttonSecondaryText"
                style="border: none;">
                Cancelar
              </button>

              <button
                type="submit"
                data-cursor-pointer
                class="px-6 py-2 font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none"
                [style.backgroundColor]="themeService.dialogPalette().buttonPrimaryBg"
                [style.color]="themeService.dialogPalette().buttonPrimaryText"
                style="border: none;">
                {{ gallery() ? 'Atualizar' : 'Criar' }}
              </button>
            </div>
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

    button[style*="rgb(150, 40, 40)"]:hover {
      filter: brightness(1.1);
    }

    input:focus,
    textarea:focus {
      border-color: var(--dialog-focus-ring) !important;
      box-shadow: 0 0 0 2px var(--dialog-focus-ring) !important;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GalleryEditorComponent implements OnInit {
  gallery = input<Gallery | null>(null);
  save = output<{ id: string | null; name: string; description: string }>();
  delete = output<string>();
  close = output<void>();

  name = '';
  description = '';

  themeService = inject(ThemeService);

  ngOnInit() {
    if (this.gallery()) {
      this.name = this.gallery()!.name;
      this.description = this.gallery()!.description;
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