import { Component, ChangeDetectionStrategy, input, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Gallery } from '../../interfaces/gallery.interface';

@Component({
  selector: 'app-gallery-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[10000]" (click)="close.emit()" data-cursor-pointer>
      <div 
        class="backdrop-blur-sm rounded-lg p-6 shadow-2xl w-full max-w-lg animate-slide-up relative"
        style="background-color: rgba(30, 30, 30, 0.95); border: 1px solid rgb(50, 50, 50);"
        (click)="$event.stopPropagation()">
        
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-medium text-gray-200 tracking-wider">
            {{ gallery() ? 'Editar Galeria' : 'Criar Galeria' }}
          </h2>
          <button
            (click)="close.emit()"
            data-cursor-pointer
            class="text-2xl leading-none rounded-sm focus:outline-none"
            style="color: rgb(180, 180, 180); background: none; border: none; padding: 0; cursor: pointer;">
            &times;
          </button>
        </div>

        <form (ngSubmit)="onSubmit()">
          <div class="mb-4">
            <label for="name" class="block text-gray-300 text-sm font-medium mb-2 tracking-wider">Nome</label>
            <input
              id="name"
              type="text"
              [(ngModel)]="name"
              name="name"
              class="w-full text-gray-200 rounded-md py-3 px-4 focus:outline-none"
              style="background-color: rgb(38, 38, 38); border: 1px solid rgb(60, 60, 60); outline: none; outline-color: transparent;"
              placeholder="Digite o nome da galeria"
              required>
          </div>

          <div class="mb-6">
            <label for="description" class="block text-gray-300 text-sm font-medium mb-2 tracking-wider">Descrição</label>
            <textarea
              id="description"
              [(ngModel)]="description"
              name="description"
              rows="3"
              class="w-full text-gray-200 rounded-md py-3 px-4 focus:outline-none"
              style="background-color: rgb(38, 38, 38); border: 1px solid rgb(60, 60, 60); outline: none; outline-color: transparent;"
              placeholder="Digite a descrição da galeria"
              required>
            </textarea>
          </div>

          <div class="flex justify-between">
            @if (gallery()) {
            <button
              type="button"
              (click)="onDelete()"
              data-cursor-pointer
              class="px-4 py-2 text-white font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none"
              style="background-color: rgb(150, 40, 40); border: none;">
              Excluir
            </button>
            }
            
            <div class="flex gap-3 ml-auto">
              <button
                type="button"
                (click)="close.emit()"
                data-cursor-pointer
                class="px-6 py-2 text-white font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none"
                style="background-color: rgb(60, 60, 60); border: none;">
                Cancelar
              </button>

              <button
                type="submit"
                data-cursor-pointer
                class="px-6 py-2 text-white font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none"
                style="background-color: rgb(60, 60, 60); border: none;">
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
      background-color: rgb(80, 80, 80) !important;
    }

    button[style*="rgb(150, 40, 40)"]:hover {
      background-color: rgb(170, 50, 50) !important;
    }

    input:focus,
    textarea:focus {
      border-color: rgb(100, 100, 100) !important;
      box-shadow: 0 0 0 2px rgba(100, 100, 100, 0.3) !important;
    }

    button[style*="color: rgb(180, 180, 180)"]:hover {
      color: white !important;
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