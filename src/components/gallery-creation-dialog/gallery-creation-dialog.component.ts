import { Component, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gallery-creation-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[10000]" (click)="onClose()">
      <div 
        class="bg-black/80 backdrop-blur-sm border border-gray-800 rounded-lg p-6 shadow-2xl w-full max-w-lg animate-slide-up relative"
        (click)="$event.stopPropagation()">
        
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-medium text-gray-200 tracking-wider">
            Criar Galeria
          </h2>
          <button 
            (click)="onClose()" 
            class="text-gray-400 hover:text-white text-2xl leading-none rounded-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500">
            &times;
          </button>
        </div>

        <form [formGroup]="galleryForm" (ngSubmit)="onSubmit()">
          <div class="mb-4">
            <label for="name" class="block text-gray-300 text-sm font-medium mb-2 tracking-wider">Nome</label>
            <input
              id="name"
              type="text"
              formControlName="name"
              class="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              placeholder="Digite o nome da galeria"
              required>
          </div>

          <div class="mb-6">
            <label for="description" class="block text-gray-300 text-sm font-medium mb-2 tracking-wider">Descrição</label>
            <textarea
              id="description"
              formControlName="description"
              rows="3"
              class="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-md py-3 px-4 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent"
              placeholder="Digite a descrição da galeria"
              required>
            </textarea>
          </div>

          <div class="flex justify-end gap-3">
            <button 
              type="button"
              (click)="onClose()"
              class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-md transition-all duration-300 tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500">
              Cancelar
            </button>
            
            <button 
              type="submit"
              [disabled]="galleryForm.invalid"
              class="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-md transition-all duration-300 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-gray-500">
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
  `],
})
export class GalleryCreationDialogComponent {
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{ name: string, description: string }>();

  galleryForm: FormGroup;

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
