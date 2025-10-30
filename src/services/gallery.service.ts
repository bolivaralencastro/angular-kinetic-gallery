import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  // A galeria agora começa vazia.
  private initialImageUrls: string[] = [];

  // Sinal reativo que armazena as URLs das imagens
  images = signal<string[]>(this.initialImageUrls);

  // Adiciona uma nova imagem no início da lista para que ela apareça imediatamente
  addImage(imageUrl: string): void {
    this.images.update(currentImages => [imageUrl, ...currentImages]);
  }
}