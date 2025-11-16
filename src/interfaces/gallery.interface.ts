export interface Gallery {
  id: string;
  galleryId: string;
  ownerId: string | null;
  name: string;
  description: string;
  imageUrls: string[];
  thumbnailUrl?: string;
  createdAt?: string; // Creation date in "DD/MM/YYYY" format
  canEditGallery?: boolean;
  canUploadToGallery?: boolean;
  canDeletePhoto?: boolean;
}