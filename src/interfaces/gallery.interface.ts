export interface Gallery {
  id: string;
  name: string;
  description: string;
  imageUrls: string[];
  thumbnailUrl?: string;
  createdAt?: string; // Creation date in "DD/MM/YYYY" format
}