import { Component, ChangeDetectionStrategy, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-info-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" (click)="onOverlayClick($event)">
      <div 
        class="bg-gray-900 border border-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        (click)="$event.stopPropagation()">
        
        <div class="p-6">
          <div class="flex justify-between items-start mb-4">
            <h2 class="text-2xl font-bold text-white">Angular Kinetic Gallery</h2>
            <button 
              (click)="close.emit()"
              class="text-gray-400 hover:text-white focus:outline-none">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div class="space-y-6 text-gray-300">
            <section>
              <h3 class="text-lg font-semibold text-white mb-2">Sobre o Projeto</h3>
              <p class="mb-3">
                Angular Kinetic Gallery é uma galeria de fotos interativa com funcionalidades avançadas de navegação, 
                captura de fotos pela webcam e organização em galerias personalizadas.
              </p>
              <p>
                Este projeto oferece uma experiência de usuário imersiva com recursos como arrastar e soltar, 
                zoom por rolagem, navegação por teclado e muito mais.
              </p>
            </section>
            
            <section>
              <h3 class="text-lg font-semibold text-white mb-2">Atalhos de Teclado</h3>
              <ul class="space-y-2">
                <li class="flex items-start">
                  <span class="inline-block px-2 py-1 bg-gray-800 rounded text-sm font-mono mr-2">Espaço</span>
                  <span>Criar nova galeria ou abrir câmera de captura</span>
                </li>
                <li class="flex items-start">
                  <span class="inline-block px-2 py-1 bg-gray-800 rounded text-sm font-mono mr-2">F</span>
                  <span>Tela cheia</span>
                </li>
                <li class="flex items-start">
                  <span class="inline-block px-2 py-1 bg-gray-800 rounded text-sm font-mono mr-2">I</span>
                  <span>Informações sobre o projeto</span>
                </li>
                <li class="flex items-start">
                  <span class="inline-block px-2 py-1 bg-gray-800 rounded text-sm font-mono mr-2">W/A/S/D</span>
                  <span>Mover a grade (também teclas de seta)</span>
                </li>
                <li class="flex items-start">
                  <span class="inline-block px-2 py-1 bg-gray-800 rounded text-sm font-mono mr-2">+</span>
                  <span>Zoom in</span>
                </li>
                <li class="flex items-start">
                  <span class="inline-block px-2 py-1 bg-gray-800 rounded text-sm font-mono mr-2">-</span>
                  <span>Zoom out</span>
                </li>
              </ul>
            </section>
            
            <section>
              <h3 class="text-lg font-semibold text-white mb-2">Controles com Mouse</h3>
              <ul class="space-y-2">
                <li>Arrastar para mover a grade</li>
                <li>Roda do mouse para zoom in/out</li>
                <li>Clique com botão direito para abrir menu de contexto</li>
                <li>Clique duplo em uma imagem para expandi-la</li>
              </ul>
            </section>
            
            <section>
              <h3 class="text-lg font-semibold text-white mb-2">Créditos</h3>
              <p class="mb-2">
                Desenvolvido por <strong>Bolívar Alencastro</strong>
              </p>
              <div class="space-y-2">
                <p>
                  <a 
                    href="https://www.linkedin.com/in/bolivaralencastro/?utm_source=angular_kinetic_gallery&utm_medium=info_dialog&utm_content=linkedin_link&utm_campaign=project_links" 
                    target="_blank" 
                    class="text-blue-400 hover:text-blue-300 underline"
                    (click)="$event.stopPropagation()">
                    LinkedIn: www.linkedin.com/in/bolivaralencastro/
                  </a>
                </p>
                <p>
                  <a 
                    href="https://www.bolivaralencastro.com.br/?utm_source=angular_kinetic_gallery&utm_medium=info_dialog&utm_content=website_link&utm_campaign=project_links" 
                    target="_blank" 
                    class="text-blue-400 hover:text-blue-300 underline"
                    (click)="$event.stopPropagation()">
                    Website: www.bolivaralencastro.com.br/
                  </a>
                </p>
              </div>
            </section>
            
            <section>
              <h3 class="text-lg font-semibold text-white mb-2">Copyright</h3>
              <p>&copy; {{ currentYear }} Bolívar Alencastro. Todos os direitos reservados.</p>
            </section>
          </div>
          
          <div class="mt-6 flex justify-end">
            <button 
              (click)="close.emit()"
              class="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors duration-200">
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoDialogComponent {
  close = output<void>();
  currentYear = new Date().getFullYear();
  
  onOverlayClick(event: Event): void {
    // Only close if the click was directly on the overlay (not on the dialog content)
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}