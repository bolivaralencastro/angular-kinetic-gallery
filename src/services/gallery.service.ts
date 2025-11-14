import { Injectable, signal, computed, inject } from '@angular/core';
import { Gallery } from '../interfaces/gallery.interface';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly ongoingUploads = new Set<string>();

  galleries = signal<Gallery[]>([]);
  selectedGalleryId = signal<string | null>(null);
  pendingCaptures = signal<string[]>([]);

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
    if (this.supabaseService.isEnabled()) {
      void this.loadRemoteGalleries();
    }
  }

  // --- Gallery Management ---

  createGallery(name: string, description: string): string | null {
    if (!this.canManage()) {
      return null;
    }

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
    this.persistGallery(newGallery);
    return newGallery.id;
  }

  getGallery(id: string): Gallery | undefined {
    return this.galleries().find(g => g.id === id);
  }

  updateGallery(id: string, name: string, description: string): void {
    if (!this.canManage()) {
      return;
    }

    this.galleries.update(currentGalleries =>
      currentGalleries.map(g =>
        g.id === id ? { ...g, name, description } : g
      )
    );
    const updatedGallery = this.getGallery(id);
    if (updatedGallery) {
      this.persistGallery(updatedGallery);
    }
  }

  deleteGallery(id: string): void {
    if (!this.canManage()) {
      return;
    }

    const galleryToDelete = this.getGallery(id);
    this.galleries.update(currentGalleries =>
      currentGalleries.filter(g => g.id !== id)
    );
    if (this.selectedGalleryId() === id) {
      this.selectedGalleryId.set(null); // Deselect if the current gallery is deleted
    }
    if (galleryToDelete) {
      void this.supabaseService.deleteGallery(id, galleryToDelete.imageUrls);
    }
  }

  selectGallery(id: string | null): void {
    this.selectedGalleryId.set(id);
  }

  // --- Image Management within a Gallery ---

  addImage(imageUrl: string): void {
    if (!this.canManage()) {
      return;
    }

    // If no gallery is selected, create a default gallery
    if (!this.selectedGalleryId()) {
      const newGalleryId = this.createGallery('Galeria Principal', 'Galeria padrão para fotos capturadas');
      if (newGalleryId) {
        this.selectedGalleryId.set(newGalleryId);
      }
    }

    const selectedGalleryId = this.selectedGalleryId();
    if (selectedGalleryId) {
      this.addImageToGallery(selectedGalleryId, imageUrl);
    }
  }

  addPendingCapture(imageUrl: string): void {
    if (!this.canManage()) {
      return;
    }

    this.pendingCaptures.update(current => [imageUrl, ...current]);
  }

  assignPendingCaptureToGallery(galleryId: string, imageUrl: string): void {
    if (!this.canManage()) {
      return;
    }

    this.pendingCaptures.update(current => current.filter(url => url !== imageUrl));
    this.addImageToGallery(galleryId, imageUrl);
  }

  removePendingCapture(imageUrl: string): void {
    if (!this.canManage()) {
      return;
    }

    this.pendingCaptures.update(current => current.filter(url => url !== imageUrl));
  }

  addImageToGallery(galleryId: string, imageUrl: string): void {
    if (!this.canManage()) {
      return;
    }

    this.galleries.update(currentGalleries =>
      currentGalleries.map(g => {
        if (g.id === galleryId) {
          const updatedImageUrls = [imageUrl, ...g.imageUrls];
          return { ...g, imageUrls: updatedImageUrls, thumbnailUrl: imageUrl }; // Set new image as thumbnail
        }
        return g;
      })
    );
    const gallery = this.getGallery(galleryId);
    if (gallery) {
      this.persistGallery(gallery);
    }

    this.syncGalleryBase64Images(galleryId, [imageUrl]);
  }

  removeImageFromGallery(galleryId: string, imageUrl: string): void {
    if (!this.canManage()) {
      return;
    }

    let nextThumbnail: string | undefined;
    this.galleries.update(currentGalleries =>
      currentGalleries.map(g => {
        if (g.id === galleryId) {
          const updatedImageUrls = g.imageUrls.filter(url => url !== imageUrl);
          nextThumbnail = updatedImageUrls[0];
          return { ...g, imageUrls: updatedImageUrls, thumbnailUrl: nextThumbnail }; // Update thumbnail
        }
        return g;
      })
    );

    const updatedGallery = this.getGallery(galleryId);
    if (updatedGallery) {
      this.persistGallery(updatedGallery);
    }

    if (this.supabaseService.isEnabled()) {
      void this.supabaseService.removeImageFromGallery(galleryId, imageUrl, nextThumbnail);
    }
  }

  private async loadRemoteGalleries(): Promise<void> {
    const remoteGalleries = await this.supabaseService.fetchGalleries();
    if (remoteGalleries === null) {
      return;
    }

    this.galleries.set(remoteGalleries);

    const selectedId = this.selectedGalleryId();
    if (selectedId && !remoteGalleries.some(gallery => gallery.id === selectedId)) {
      this.selectedGalleryId.set(null);
    }
  }

  private syncGalleryBase64Images(galleryId: string, imageUrls: readonly string[]): void {
    if (!this.supabaseService.isEnabled()) {
      return;
    }

    if (!this.canManage()) {
      return;
    }

    imageUrls
      .filter(url => url.startsWith('data:'))
      .forEach(base64Url => {
        if (!this.beginUpload(galleryId, base64Url)) {
          return;
        }

        void this.supabaseService.uploadImage(galleryId, base64Url).then(remoteUrl => {
          if (!remoteUrl) {
            return;
          }

          this.galleries.update(currentGalleries =>
            currentGalleries.map(g => {
              if (g.id === galleryId) {
                const updatedImageUrls = g.imageUrls.map(url => (url === base64Url ? remoteUrl : url));
                const updatedThumbnail = g.thumbnailUrl === base64Url ? remoteUrl : g.thumbnailUrl;
                return { ...g, imageUrls: updatedImageUrls, thumbnailUrl: updatedThumbnail };
              }
              return g;
            }),
          );

          const updatedGallery = this.getGallery(galleryId);
          if (updatedGallery) {
            this.persistGallery(updatedGallery);
          }
        }).finally(() => {
          this.endUpload(galleryId, base64Url);
        });
      });
  }

  private beginUpload(galleryId: string, imageUrl: string): boolean {
    const key = this.createUploadKey(galleryId, imageUrl);
    if (this.ongoingUploads.has(key)) {
      return false;
    }

    this.ongoingUploads.add(key);
    return true;
  }

  private endUpload(galleryId: string, imageUrl: string): void {
    this.ongoingUploads.delete(this.createUploadKey(galleryId, imageUrl));
  }

  private createUploadKey(galleryId: string, imageUrl: string): string {
    const prefix = imageUrl.slice(0, 64);
    const suffix = imageUrl.slice(-16);
    return `${galleryId}::${imageUrl.length}::${prefix}::${suffix}`;
  }

  private persistGallery(gallery: Gallery): void {
    if (!this.canManage()) {
      return;
    }

    void this.supabaseService.upsertGallery(gallery);
  }

  private canManage(): boolean {
    return this.authService.canManageContent();
  }
}