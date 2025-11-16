export interface SupabaseGalleryImageRecord {
  image_url: string | null;
  created_at: string | null;
}

export interface SupabaseGalleryRecord {
  id: string;
  gallery_id?: string | null;
  owner_id?: string | null;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
  gallery_images: SupabaseGalleryImageRecord[] | null;
}
