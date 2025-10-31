import { Component, ChangeDetectionStrategy, input, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Gallery } from '../../interfaces/gallery.interface';

@Component({
  selector: 'app-gallery-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[10000]" (click)="close.emit()">
      <div 
        class="bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg p-6 shadow-2xl w-full max-w-lg animate-slide-up relative"
        (click)="$event.stopPropagation()">
        
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-medium text-gray-200 tracking-wider">
            {{ gallery() ? 'Editar Galeria' : 'Criar Galeria' }}
          </h2>
          <button 
            (click)="close.emit()" 
            class="text-gray-400 hover:text-white text-2xl leading-none rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500">
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
              class="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
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
              class="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              placeholder="Digite a descrição da galeria"
              required>
            </textarea>
          </div>

          <div class="flex justify-between">
            @if (gallery()) {
            <button 
              type="button"
              (click)="onDelete()"
              class="px-4 py-2 bg-red-700 hover:bg-red-600 text-white font-bold rounded-md transition-all duration-300 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-red-500">
              Excluir
            </button>
            }
            
            <div class="flex gap-3 ml-auto">
              <button 
                type="button"
                (click)="close.emit()"
                class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500">
                Cancelar
              </button>
              
              <button 
                type="submit"
                class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-md transition-all duration-300 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500">
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