import { Injectable, signal, computed, inject } from '@angular/core';
import { Gallery } from '../interfaces/gallery.interface';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';

type PendingUpload = Readonly<{
  galleryId: string;
  dataUrl: string;
}>;

@Injectable({
  providedIn: 'root'
})
export class GalleryService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly authService = inject(AuthService);
  private readonly ongoingUploads = new Set<string>();
  private readonly pendingUploadsStorageKey = 'kinetic-gallery.pending-uploads';

  galleries = signal<Gallery[]>([]);
  selectedGalleryId = signal<string | null>(null);
  pendingCaptures = signal<string[]>([]);
  currentUserGalleryId = signal<string | null>(null);
  lastErrorMessage = signal<string | null>(null);

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
    void this.initializeData();
  }

  // --- Gallery Management ---

  private async initializeData(): Promise<void> {
    if (this.supabaseService.isEnabled()) {
      await this.syncCurrentUserGallery();
      await this.loadRemoteGalleries();
    }

    this.restorePendingUploads();
  }

  private async syncCurrentUserGallery(): Promise<void> {
    const result = await this.supabaseService.syncCurrentUserGallery();
    if (!result.success) {
      this.setError(result.error ?? 'Não foi possível sincronizar a galeria do usuário.');
      return;
    }

    const galleryId = result.data ?? null;
    this.currentUserGalleryId.set(galleryId);

    if (!this.authService.canManageContent() && galleryId) {
      this.selectedGalleryId.set(galleryId);
    }
  }

  async createGallery(name: string, description: string): Promise<string | null> {
    const ownerId = this.authService.ownerId();
    if (!this.requireOwnerOrAdmin(ownerId)) {
      return null;
    }

    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const createdAt = `${day}/${month}/${year}`;

    const galleryId = crypto.randomUUID();

    const newGallery: Gallery = {
      id: galleryId,
      galleryId,
      ownerId,
      name,
      description,
      imageUrls: [],
      thumbnailUrl: undefined,
      createdAt,
      canEditGallery: true,
      canUploadToGallery: true,
      canDeletePhoto: true,
    };

    if (this.supabaseService.isEnabled()) {
      const result = await this.supabaseService.upsertGallery(newGallery);
      if (!result.success) {
        this.setError(result.error ?? 'Não foi possível criar a galeria.');
        return null;
      }
    }

    this.galleries.update(currentGalleries => [newGallery, ...currentGalleries]);
    this.setError(null);
    return newGallery.id;
  }

  getGallery(id: string): Gallery | undefined {
    return this.galleries().find(gallery => gallery.id === id || gallery.galleryId === id);
  }

  async updateGallery(id: string, name: string, description: string): Promise<boolean> {
    const gallery = this.getGallery(id);
    if (!this.requireOwnership(gallery)) {
      return false;
    }

    const updatedGallery: Gallery = this.withPermissions({ ...gallery, name, description });
    if (this.supabaseService.isEnabled()) {
      const result = await this.supabaseService.upsertGallery(updatedGallery);
      if (!result.success) {
        this.setError(result.error ?? 'Não foi possível atualizar a galeria.');
        return false;
      }
    }

    this.galleries.update(currentGalleries =>
      currentGalleries.map(g => (g.id === id ? updatedGallery : g))
    );
    this.setError(null);
    return true;
  }

  async deleteGallery(id: string): Promise<boolean> {
    const galleryToDelete = this.getGallery(id);
    if (!this.requireOwnership(galleryToDelete)) {
      return false;
    }

    if (this.supabaseService.isEnabled()) {
      const result = await this.supabaseService.deleteGallery(id, galleryToDelete.imageUrls);
      if (!result.success) {
        this.setError(result.error ?? 'Não foi possível excluir a galeria.');
        return false;
      }
    }

    this.galleries.update(currentGalleries => currentGalleries.filter(g => g.id !== id));
    if (this.selectedGalleryId() === id) {
      this.selectedGalleryId.set(null);
    }
    this.setError(null);
    return true;
  }

  selectGallery(id: string | null): void {
    this.selectedGalleryId.set(id);
  }

  // --- Image Management within a Gallery ---

  async addImage(imageUrl: string): Promise<boolean> {
    if (!this.selectedGalleryId()) {
      const newGalleryId = await this.createGallery('Galeria Principal', 'Galeria padrão para fotos capturadas');
      if (newGalleryId) {
        this.selectedGalleryId.set(newGalleryId);
      } else {
        return false;
      }
    }

    const selectedGalleryId = this.selectedGalleryId();
    if (!selectedGalleryId) {
      this.setError('Selecione uma galeria para salvar a imagem.');
      return false;
    }

    const targetGallery = this.getGallery(selectedGalleryId);
    if (!this.requireOwnership(targetGallery)) {
      return false;
    }

    this.pendingCaptures.update(current => [imageUrl, ...current]);
    return true;
  }

  addPendingCapture(imageUrl: string): void {
    this.pendingCaptures.update(current => [imageUrl, ...current]);
  }

  async assignPendingCaptureToGallery(galleryId: string, imageUrl: string): Promise<boolean> {
    this.pendingCaptures.update(current => current.filter(url => url !== imageUrl));
    return this.addImageToGallery(galleryId, imageUrl);
  }

  removePendingCapture(imageUrl: string): void {
    this.pendingCaptures.update(current => current.filter(url => url !== imageUrl));
  }

  async addImageToGallery(galleryId: string, imageUrl: string): Promise<boolean> {
    const gallery = this.getGallery(galleryId);
    if (!this.requireOwnership(gallery)) {
      return false;
    }

    const updatedGallery: Gallery = this.withPermissions({
      ...gallery,
      imageUrls: [imageUrl, ...gallery.imageUrls],
      thumbnailUrl: imageUrl,
    });

    this.galleries.update(currentGalleries =>
      currentGalleries.map(g => (g.id === galleryId ? updatedGallery : g))
    );

    if (imageUrl.startsWith('data:')) {
      this.registerPendingUpload(galleryId, imageUrl);
    }

    this.syncGalleryBase64Images(galleryId, [imageUrl]);
    this.setError(null);
    return true;
  }

  async removeImageFromGallery(galleryId: string, imageUrl: string): Promise<boolean> {
    const gallery = this.getGallery(galleryId);
    if (!this.requireOwnership(gallery)) {
      return false;
    }

    let nextThumbnail: string | undefined;
    this.galleries.update(currentGalleries =>
      currentGalleries.map(g => {
        if (g.id === galleryId) {
          const updatedImageUrls = g.imageUrls.filter(url => url !== imageUrl);
          nextThumbnail = updatedImageUrls[0];
          return { ...g, imageUrls: updatedImageUrls, thumbnailUrl: nextThumbnail };
        }
        return g;
      })
    );

    if (imageUrl.startsWith('data:')) {
      this.unregisterPendingUpload(galleryId, imageUrl);
    }

    if (this.supabaseService.isEnabled()) {
      const result = await this.supabaseService.removeImageFromGallery(galleryId, imageUrl, nextThumbnail);
      if (!result.success) {
        this.setError(result.error ?? 'Não foi possível remover a imagem.');
        return false;
      }
    }

    const updatedGallery = this.getGallery(galleryId);
    if (updatedGallery) {
      void this.persistGallery(updatedGallery);
    }

    this.setError(null);
    return true;
  }

  private async loadRemoteGalleries(): Promise<void> {
    const result = await this.supabaseService.fetchGalleries();
    if (!result.success) {
      this.setError(result.error ?? 'Não foi possível carregar as galerias.');
      return;
    }

    const remoteGalleries = result.data ?? [];
    this.galleries.set(remoteGalleries.map(gallery => this.withPermissions(gallery)));

    const selectedId = this.selectedGalleryId();
    const selectedGallery = this.findGalleryByIdOrAlias(selectedId, remoteGalleries);
    if (selectedId && !selectedGallery) {
      this.selectedGalleryId.set(null);
    } else if (selectedGallery) {
      this.selectedGalleryId.set(selectedGallery.id);
    }

    const defaultUserGallery = this.currentUserGalleryId();
    if (!this.authService.canManageContent() && !this.selectedGalleryId() && defaultUserGallery) {
      const resolvedDefault = this.findGalleryByIdOrAlias(defaultUserGallery, remoteGalleries);
      if (resolvedDefault) {
        this.selectedGalleryId.set(resolvedDefault.id);
      }
    }
  }

  private syncGalleryBase64Images(galleryId: string, imageUrls: readonly string[]): void {
    if (!this.supabaseService.isEnabled()) {
      return;
    }

    const gallery = this.getGallery(galleryId);
    if (!this.requireOwnership(gallery)) {
      return;
    }

    imageUrls
      .filter(url => url.startsWith('data:'))
      .forEach(base64Url => {
        if (!this.beginUpload(galleryId, base64Url)) {
          return;
        }

        void this.supabaseService.uploadImage(galleryId, base64Url).then(async remoteResult => {
          if (!remoteResult.success || !remoteResult.data) {
            this.setError(remoteResult.error ?? 'Não foi possível enviar a imagem.');
            this.removeBase64Placeholder(galleryId, base64Url);
            return;
          }

          const remoteUrl = remoteResult.data;

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
            await this.persistGallery(updatedGallery);
          }

          this.unregisterPendingUpload(galleryId, base64Url);
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

  private removeBase64Placeholder(galleryId: string, placeholder: string): void {
    this.galleries.update(currentGalleries =>
      currentGalleries.map(gallery => {
        if (gallery.id !== galleryId) {
          return gallery;
        }

        const imageUrls = gallery.imageUrls.filter(url => url !== placeholder);
        const thumbnailUrl = gallery.thumbnailUrl === placeholder ? imageUrls[0] : gallery.thumbnailUrl;
        return { ...gallery, imageUrls, thumbnailUrl };
      }),
    );
  }

  private createUploadKey(galleryId: string, imageUrl: string): string {
    const prefix = imageUrl.slice(0, 64);
    const suffix = imageUrl.slice(-16);
    return `${galleryId}::${imageUrl.length}::${prefix}::${suffix}`;
  }

  private async persistGallery(gallery: Gallery): Promise<boolean> {
    if (!this.requireOwnership(gallery)) {
      return false;
    }

    const result = await this.supabaseService.upsertGallery(gallery);
    if (!result.success) {
      this.setError(result.error ?? 'Não foi possível atualizar a galeria.');
      return false;
    }

    return true;
  }

  private registerPendingUpload(galleryId: string, imageUrl: string): void {
    if (!this.canUseLocalStorage()) {
      return;
    }

    this.updatePendingUploads(current => {
      const exists = current.some(
        pending => pending.galleryId === galleryId && pending.dataUrl === imageUrl,
      );

      if (exists) {
        return current;
      }

      return [{ galleryId, dataUrl: imageUrl }, ...current];
    });
  }

  private unregisterPendingUpload(galleryId: string, imageUrl: string): void {
    if (!this.canUseLocalStorage()) {
      return;
    }

    this.updatePendingUploads(current =>
      current.filter(pending => !(pending.galleryId === galleryId && pending.dataUrl === imageUrl)),
    );
  }

  private restorePendingUploads(): void {
    const pending = this.readPendingUploads();

    if (pending.length === 0) {
      return;
    }

    const imagesByGallery = pending.reduce<Map<string, string[]>>((map, { galleryId, dataUrl }) => {
      const images = map.get(galleryId) ?? [];
      if (!images.includes(dataUrl)) {
        images.unshift(dataUrl);
      }
      map.set(galleryId, images);
      return map;
    }, new Map());

    this.galleries.update(currentGalleries =>
      currentGalleries.map(gallery => {
        const pendingImages = imagesByGallery.get(gallery.id);
        if (!pendingImages || pendingImages.length === 0) {
          return gallery;
        }

        const mergedImages = [...pendingImages, ...gallery.imageUrls.filter(url => !pendingImages.includes(url))];
        const thumbnail = mergedImages[0] ?? gallery.thumbnailUrl;
        return { ...gallery, imageUrls: mergedImages, thumbnailUrl: thumbnail };
      }),
    );

    imagesByGallery.forEach((images, galleryId) => {
      this.syncGalleryBase64Images(galleryId, images);
    });
  }

  private readPendingUploads(): PendingUpload[] {
    if (!this.canUseLocalStorage()) {
      return [];
    }

    try {
      const raw = window.localStorage.getItem(this.pendingUploadsStorageKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw) as PendingUpload[];
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.filter(
        (item): item is PendingUpload =>
          Boolean(item) && typeof item.galleryId === 'string' && typeof item.dataUrl === 'string',
      );
    } catch (error) {
      console.error('Falha ao restaurar uploads pendentes do localStorage', error);
      return [];
    }
  }

  private updatePendingUploads(mutator: (current: PendingUpload[]) => PendingUpload[]): void {
    const current = this.readPendingUploads();
    const updated = mutator(current);

    try {
      window.localStorage.setItem(this.pendingUploadsStorageKey, JSON.stringify(updated));
    } catch (error) {
      console.error('Falha ao persistir uploads pendentes no localStorage', error);
    }
  }

  private canUseLocalStorage(): boolean {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  }

  private requireOwnership(gallery: Gallery | null | undefined): gallery is Gallery {
    if (!gallery) {
      this.setError('Galeria não encontrada.');
      return false;
    }

    return this.requireOwnerOrAdmin(gallery.ownerId);
  }

  private requireOwnerOrAdmin(ownerId: string | null): boolean {
    if (!this.authService.isAuthenticated()) {
      this.setError('Faça login para gerenciar galerias.');
      return false;
    }

    if (this.authService.canManageContent()) {
      return true;
    }

    const normalizedOwner = ownerId?.trim();
    if (!normalizedOwner) {
      this.setError('Não foi possível validar o proprietário da galeria.');
      return false;
    }

    if (!this.authService.canManageGallery(normalizedOwner)) {
      this.setError('Você não tem permissão para alterar esta galeria.');
      return false;
    }

    return true;
  }

  private setError(message: string | null): void {
    this.lastErrorMessage.set(message);
  }

  private findGalleryByIdOrAlias(id: string | null, galleries: readonly Gallery[]): Gallery | undefined {
    if (!id) {
      return undefined;
    }

    return galleries.find(gallery => gallery.id === id || gallery.galleryId === id);
  }

  private withPermissions(gallery: Gallery): Gallery {
    const canEdit = this.authService.canManageGallery(gallery.ownerId ?? '');

    return {
      ...gallery,
      canEditGallery: canEdit,
      canUploadToGallery: canEdit,
      canDeletePhoto: canEdit,
    };
  }
}