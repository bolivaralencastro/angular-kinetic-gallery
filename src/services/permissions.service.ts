import { Injectable, computed, inject } from '@angular/core';
import { Gallery } from '../interfaces/gallery.interface';
import { AuthService } from './auth.service';
import { GalleryService } from './gallery.service';

type GalleryPermissionKey = 'canEditGallery' | 'canUploadToGallery' | 'canDeletePhoto';

@Injectable({
  providedIn: 'root',
})
export class PermissionsService {
  private readonly authService = inject(AuthService);
  private readonly galleryService = inject(GalleryService);

  private readonly selectedGallery = computed(() => {
    const selectedId = this.galleryService.selectedGalleryId();
    if (!selectedId) {
      return null;
    }
    return this.galleryService.getGallery(selectedId) ?? null;
  });

  readonly canManageContent = computed(() => this.authService.canManageContent());
  readonly canCreateGalleries = computed(() => this.canManageContent());
  readonly canViewMobileGalleryList = computed(() => this.canCreateGalleries());

  readonly canManageSelectedGallery = computed(() => this.canEditGalleryById(this.galleryService.selectedGalleryId()));
  readonly canEditSelectedGallery = computed(() => this.canEditGalleryFromEntity(this.selectedGallery()));
  readonly canUploadToSelectedGallery = computed(() => this.canUploadToGalleryFromEntity(this.selectedGallery()));
  readonly canDeleteSelectedGallery = computed(() => this.canEditGalleryFromEntity(this.selectedGallery()));
  readonly canCaptureInSelectedGallery = computed(() =>
    this.canUploadToGalleryById(this.galleryService.selectedGalleryId())
  );

  readonly canUseCaptureDialog = computed(
    () => this.canUploadToSelectedGallery() || this.canCreateGalleries()
  );

  canManageGalleryById(galleryId: string | null): boolean {
    return this.canEditGalleryById(galleryId);
  }

  canEditGalleryById(galleryId: string | null): boolean {
    const gallery = this.resolveGallery(galleryId);
    return this.canEditGalleryFromEntity(gallery);
  }

  canUploadToGalleryById(galleryId: string | null): boolean {
    const gallery = this.resolveGallery(galleryId);
    return this.canUploadToGalleryFromEntity(gallery);
  }

  canDeletePhotoById(galleryId: string | null): boolean {
    const gallery = this.resolveGallery(galleryId);
    return this.canDeletePhotoFromEntity(gallery);
  }

  canCaptureInGallery(galleryId: string | null): boolean {
    return this.canUploadToGalleryById(galleryId);
  }

  private resolveGallery(galleryId: string | null): Gallery | null {
    if (!galleryId) {
      return null;
    }
    return this.galleryService.getGallery(galleryId) ?? null;
  }

  private canEditGalleryFromEntity(gallery: Gallery | null): boolean {
    return this.computeGalleryPermission(gallery, 'canEditGallery');
  }

  private canUploadToGalleryFromEntity(gallery: Gallery | null): boolean {
    return this.computeGalleryPermission(gallery, 'canUploadToGallery');
  }

  private canDeletePhotoFromEntity(gallery: Gallery | null): boolean {
    return this.computeGalleryPermission(gallery, 'canDeletePhoto');
  }

  private computeGalleryPermission(gallery: Gallery | null, key: GalleryPermissionKey): boolean {
    if (!gallery) {
      return false;
    }

    const explicitPermission = gallery[key];
    if (typeof explicitPermission === 'boolean') {
      return explicitPermission;
    }

    return this.authService.canManageGallery(gallery.ownerId ?? '');
  }
}
