export interface SupabaseGalleryImageRecord {
  image_url: string | null;
  created_at: string | null;
}

export interface SupabaseGalleryRecord {
  id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
  gallery_images: SupabaseGalleryImageRecord[] | null;
}
