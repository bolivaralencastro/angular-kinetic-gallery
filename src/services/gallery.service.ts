import { Injectable, signal, effect, computed, inject } from '@angular/core';
import { Gallery } from '../interfaces/gallery.interface';
import { SupabaseService } from './supabase.service';

const STORAGE_KEY_GALLERIES = 'kinetic-galleries';
const STORAGE_KEY_PENDING_CAPTURES = 'kinetic-pending-captures';

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly ongoingUploads = new Set<string>();

  private initialGalleries: Gallery[] = this.loadGalleriesFromLocalStorage();
  private initialPendingCaptures: string[] = this.loadPendingCapturesFromLocalStorage();

  galleries = signal<Gallery[]>(this.initialGalleries);
  selectedGalleryId = signal<string | null>(null);
  pendingCaptures = signal<string[]>(this.initialPendingCaptures);

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

    effect(() => {
      this.saveGalleriesToLocalStorage(this.galleries());
    });

    effect(() => {
      this.savePendingCapturesToLocalStorage(this.pendingCaptures());
    });
  }

  // --- Gallery Management ---

  createGallery(name: string, description: string): string {
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
    // If no gallery is selected, create a default gallery
    if (!this.selectedGalleryId()) {
      const newGalleryId = this.createGallery('Galeria Principal', 'Galeria padrão para fotos capturadas');
      this.selectedGalleryId.set(newGalleryId);
    }

    const selectedGalleryId = this.selectedGalleryId();
    if (selectedGalleryId) {
      this.addImageToGallery(selectedGalleryId, imageUrl);
    }
  }

  addPendingCapture(imageUrl: string): void {
    this.pendingCaptures.update(current => [imageUrl, ...current]);
  }

  assignPendingCaptureToGallery(galleryId: string, imageUrl: string): void {
    this.pendingCaptures.update(current => current.filter(url => url !== imageUrl));
    this.addImageToGallery(galleryId, imageUrl);
  }

  removePendingCapture(imageUrl: string): void {
    this.pendingCaptures.update(current => current.filter(url => url !== imageUrl));
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
    const gallery = this.getGallery(galleryId);
    if (gallery) {
      this.persistGallery(gallery);
    }

    this.syncGalleryBase64Images(galleryId, [imageUrl]);
  }

  removeImageFromGallery(galleryId: string, imageUrl: string): void {
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

  // --- Local Storage Handling ---

  private saveGalleriesToLocalStorage(galleries: Gallery[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_GALLERIES, JSON.stringify(galleries));
    } catch (e) {
      console.error('Error saving galleries to localStorage', e);
    }
  }

  private savePendingCapturesToLocalStorage(pending: string[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_PENDING_CAPTURES, JSON.stringify(pending));
    } catch (e) {
      console.error('Error saving pending captures to localStorage', e);
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

  private loadPendingCapturesFromLocalStorage(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PENDING_CAPTURES);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error('Error reading pending captures from localStorage', e);
      return [];
    }
  }

  private async loadRemoteGalleries(): Promise<void> {
    const remoteGalleries = await this.supabaseService.fetchGalleries();
    if (remoteGalleries.length === 0) {
      return;
    }

    const currentGalleries = this.galleries();
    const remoteMap = new Map(remoteGalleries.map(gallery => [gallery.id, gallery] as const));
    const galleriesToSync: Array<{ id: string; base64Urls: string[] }> = [];

    const mergedGalleries = remoteGalleries.map(remote => {
      const local = currentGalleries.find(gallery => gallery.id === remote.id);
      if (!local) {
        return remote;
      }

      const remoteImageSet = new Set(remote.imageUrls);
      const base64Images = local.imageUrls.filter(url => url.startsWith('data:'));
      const additionalLocalImages = local.imageUrls.filter(
        url => !remoteImageSet.has(url) && !url.startsWith('data:'),
      );

      if (base64Images.length > 0) {
        galleriesToSync.push({ id: remote.id, base64Urls: base64Images });
      }

      return {
        ...remote,
        imageUrls: [...remote.imageUrls, ...additionalLocalImages, ...base64Images],
        thumbnailUrl: remote.thumbnailUrl ?? local.thumbnailUrl,
        createdAt: remote.createdAt ?? local.createdAt,
      };
    });

    for (const localGallery of currentGalleries) {
      if (remoteMap.has(localGallery.id)) {
        continue;
      }

      mergedGalleries.push(localGallery);
      this.persistGallery(localGallery);

      const base64Images = localGallery.imageUrls.filter(url => url.startsWith('data:'));
      if (base64Images.length > 0) {
        galleriesToSync.push({ id: localGallery.id, base64Urls: base64Images });
      }
    }

    this.galleries.set(mergedGalleries);

    const selectedId = this.selectedGalleryId();
    if (selectedId && !mergedGalleries.some(gallery => gallery.id === selectedId)) {
      this.selectedGalleryId.set(null);
    }

    for (const { id, base64Urls } of galleriesToSync) {
      this.syncGalleryBase64Images(id, base64Urls);
    }
  }

  private syncGalleryBase64Images(galleryId: string, imageUrls: readonly string[]): void {
    if (!this.supabaseService.isEnabled()) {
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
    void this.supabaseService.upsertGallery(gallery);
  }
}