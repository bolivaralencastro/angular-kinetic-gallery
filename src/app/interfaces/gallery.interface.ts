export interface Gallery {
  id: string;
  galleryId: string;
  ownerId: string | null;
  name: string;
  description: string;
  imageUrls: string[];
  thumbnailUrl?: string; // Optional: for displaying a preview of the gallery
  createdAt?: string; // Optional: creation date in "DD/MM/YYYY" format
}