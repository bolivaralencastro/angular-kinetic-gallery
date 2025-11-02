import { Injectable, signal, effect, computed } from '@angular/core';
import { Gallery } from '../interfaces/gallery.interface';

const STORAGE_KEY_GALLERIES = 'kinetic-galleries';

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  private initialGalleries: Gallery[] = this.loadGalleriesFromLocalStorage();

  galleries = signal<Gallery[]>(this.initialGalleries);
  selectedGalleryId = signal<string | null>(null);

  // Computed signal for the images of the currently selected gallery
  images = computed(() => {
    const selectedId = this.selectedGalleryId();
    if (!selectedId) {
      return [];
    }
    const gallery = this.galleries().find(g => g.id === selectedId);
    return gallery ? gallery.imageUrls : [];
  });

  constructor() {
    effect(() => {
      this.saveGalleriesToLocalStorage(this.galleries());
    });
  }

  // --- Gallery Management ---

  createGallery(name: string, description: string): void {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = now.getFullYear();
    const createdAt = `${day}/${month}/${year}`;
    
    const newGallery: Gallery = {
      id: crypto.randomUUID(), // Generate a unique ID
      name,
      description,
      imageUrls: [],
      thumbnailUrl: undefined,
      createdAt,
    };
    this.galleries.update(currentGalleries => [newGallery, ...currentGalleries]);
  }

  getGallery(id: string): Gallery | undefined {
    return this.galleries().find(g => g.id === id);
  }

  updateGallery(id: string, name: string, description: string): void {
    this.galleries.update(currentGalleries =>
      currentGalleries.map(g =>
        g.id === id ? { ...g, name, description } : g
      )
    );
  }

  deleteGallery(id: string): void {
    this.galleries.update(currentGalleries =>
      currentGalleries.filter(g => g.id !== id)
    );
    if (this.selectedGalleryId() === id) {
      this.selectedGalleryId.set(null); // Deselect if the current gallery is deleted
    }
  }

  selectGallery(id: string | null): void {
    this.selectedGalleryId.set(id);
  }

  // --- Image Management within a Gallery ---

  addImage(imageUrl: string): void {
    // If no gallery is selected, create a default gallery
    if (!this.selectedGalleryId()) {
      this.createGallery('Galeria Principal', 'Galeria padrão para fotos capturadas');
      // After creating the gallery, we need to wait for it to be selected, so we'll add to the first gallery
      const firstGallery = this.galleries()[0];
      if (firstGallery) {
        this.selectedGalleryId.set(firstGallery.id);
      }
    }
    
    const selectedGalleryId = this.selectedGalleryId();
    if (selectedGalleryId) {
      this.addImageToGallery(selectedGalleryId, imageUrl);
    }
  }

  addImageToGallery(galleryId: string, imageUrl: string): void {
    this.galleries.update(currentGalleries =>
      currentGalleries.map(g => {
        if (g.id === galleryId) {
          const updatedImageUrls = [imageUrl, ...g.imageUrls];
          return { ...g, imageUrls: updatedImageUrls, thumbnailUrl: imageUrl }; // Set new image as thumbnail
        }
        return g;
      })
    );
  }

  removeImageFromGallery(galleryId: string, imageUrl: string): void {
    this.galleries.update(currentGalleries =>
      currentGalleries.map(g => {
        if (g.id === galleryId) {
          const updatedImageUrls = g.imageUrls.filter(url => url !== imageUrl);
          return { ...g, imageUrls: updatedImageUrls, thumbnailUrl: updatedImageUrls[0] || undefined }; // Update thumbnail
        }
        return g;
      })
    );
  }

  // --- Local Storage Handling ---

  private saveGalleriesToLocalStorage(galleries: Gallery[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_GALLERIES, JSON.stringify(galleries));
    } catch (e) {
      console.error('Error saving galleries to localStorage', e);
    }
  }

  private loadGalleriesFromLocalStorage(): Gallery[] {
    try {
      const storedGalleries = localStorage.getItem(STORAGE_KEY_GALLERIES);
      const galleries: Gallery[] = storedGalleries ? JSON.parse(storedGalleries) : [];
      
      // Add createdAt field to galleries that don't have it (for backward compatibility)
      return galleries.map(gallery => {
        if (!gallery.createdAt) {
          // Try to extract date from gallery name if it follows the timestamp format
          const dateRegex = /Galeria\s+(\d{1,2}\/\d{1,2}\/\d{4})/;
          const match = gallery.name.match(dateRegex);
          if (match) {
            return { ...gallery, createdAt: match[1] };
          } else {
            // For galleries without timestamp format, use current date as fallback
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const createdAt = `${day}/${month}/${year}`;
            return { ...gallery, createdAt };
          }
        }
        return gallery;
      });
    } catch (e) {
      console.error('Error reading galleries from localStorage', e);
      return [];
    }
  }
}