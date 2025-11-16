import { Injectable, inject } from '@angular/core';
import { environment } from '../environments/environment';
import { Gallery } from '../interfaces/gallery.interface';
import type { SupabaseGalleryImageRecord, SupabaseGalleryRecord } from '../types/supabase';
import { AuthService } from './auth.service';

type RequestOptions = Omit<RequestInit, 'headers'> & { headers?: Record<string, string> };
type RemoteResult<T = void> = Readonly<
  | { success: true; data?: T; error?: undefined }
  | { success: false; error: string; data?: undefined }
>;

@Injectable({
  providedIn: 'root',
})
export class SupabaseService {
  private readonly baseUrl = environment.supabaseUrl.replace(/\/+$/, '');
  private readonly anonKey = environment.supabaseAnonKey;
  private readonly bucketName = environment.supabaseBucket;
  private readonly authService = inject(AuthService);
  private currentUserGalleryId: string | null = null;

  getCurrentUserGalleryId(): string | null {
    return this.currentUserGalleryId;
  }

  isEnabled(): boolean {
    return Boolean(this.baseUrl && this.anonKey);
  }

  private async restRequest(path: string, init: RequestOptions = {}): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        ...this.buildRestHeaders(),
        ...(init.headers ?? {}),
      },
    });

    this.handleUnauthorized(response);
    return response;
  }

  private async storageRequest(
    path: string,
    init: RequestOptions = {},
    contentType?: string,
  ): Promise<Response> {
    const response = await fetch(`${this.baseUrl}/storage/v1/${path}`, {
      ...init,
      headers: {
        ...this.buildStorageHeaders(contentType),
        ...(init.headers ?? {}),
      },
    });

    this.handleUnauthorized(response);
    return response;
  }

  private logFailure(context: string, detail: unknown): void {
    console.error(`${context}:`, detail);
  }

  private logUnexpected(context: string, error: unknown): void {
    console.error(`${context}:`, error);
  }

  private handleUnauthorized(response: Response): void {
    if (response.status === 401) {
      this.authService.handleUnauthorized();
    }
  }

  private async buildError(response: Response, fallback: string): Promise<string> {
    const parsed = await this.extractError(response);
    const base = parsed ?? fallback;

    if (response.status === 401 || response.status === 403) {
      return 'Acesso negado: você não tem permissão para operar nesta galeria.';
    }

    return base;
  }

  private async extractError(response: Response): Promise<string | null> {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        const body = await response.json();
        const message = (body as { message?: string; error?: string }).message ?? (body as { error?: string }).error;
        return typeof message === 'string' && message.length > 0 ? message : null;
      }

      const text = await response.text();
      return text || null;
    } catch (error) {
      console.error('Falha ao interpretar resposta de erro do Supabase:', error);
      return null;
    }
  }

  async fetchGalleries(): Promise<RemoteResult<Gallery[]>> {
    if (!this.isEnabled()) {
      return { success: true, data: [] };
    }

    try {
      const response = await this.restRequest(
        'galleries?select=id,gallery_id,owner_id,name,description,thumbnail_url,created_at,gallery_images:gallery_images(image_url,created_at)&order=created_at.desc',
      );

      if (!response.ok) {
        this.logFailure('Falha ao buscar galerias no Supabase', await response.text());
        return { success: false, error: await this.buildError(response, 'Não foi possível carregar as galerias.') };
      }

      const data = (await response.json()) as SupabaseGalleryRecord[];
      return {
        success: true,
        data: data.map(record => ({
          id: record.id,
          galleryId: record.gallery_id ?? record.id,
          ownerId: record.owner_id ?? null,
          name: record.name,
          description: record.description ?? '',
          imageUrls: this.extractGalleryImageUrls(record.gallery_images),
          thumbnailUrl: record.thumbnail_url ?? undefined,
          createdAt: this.formatDate(record.created_at),
        })),
      };
    } catch (error) {
      this.logUnexpected('Erro inesperado ao carregar galerias do Supabase', error);
      return { success: false, error: 'Erro inesperado ao carregar galerias.' };
    }
  }

  async syncCurrentUserGallery(): Promise<RemoteResult<string | null>> {
    if (!this.isEnabled() || !this.authService.isAuthenticated()) {
      this.currentUserGalleryId = null;
      return { success: true, data: null };
    }

    try {
      const response = await this.restRequest('rpc/get_or_create_user_gallery', { method: 'POST' });

      if (!response.ok) {
        this.logFailure('Falha ao obter galeria padrão do usuário', await response.text());
        return { success: false, error: await this.buildError(response, 'Não foi possível recuperar a sua galeria.') };
      }

      const body = (await response.json()) as { gallery_id?: string | null } | null;
      const galleryId = typeof body?.gallery_id === 'string' ? body.gallery_id : null;
      this.currentUserGalleryId = galleryId;
      return { success: true, data: galleryId };
    } catch (error) {
      this.logUnexpected('Erro inesperado ao sincronizar galeria do usuário', error);
      return { success: false, error: 'Erro inesperado ao carregar galeria do usuário.' };
    }
  }

  async upsertGallery(gallery: Gallery): Promise<RemoteResult<void>> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    try {
      const payload: Record<string, unknown> = {
        id: gallery.id,
        gallery_id: gallery.galleryId,
        owner_id: gallery.ownerId,
        name: gallery.name,
        description: gallery.description,
        thumbnail_url: this.sanitizeThumbnailUrl(gallery.thumbnailUrl),
      };

      const parsedDate = this.parseDate(gallery.createdAt);
      if (parsedDate) {
        payload.created_at = parsedDate;
      }

      const response = await this.restRequest('galleries', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        this.logFailure('Falha ao salvar galeria no Supabase', await response.text());
        return { success: false, error: await this.buildError(response, 'Não foi possível salvar a galeria.') };
      }

      return { success: true };
    } catch (error) {
      this.logUnexpected('Erro inesperado ao salvar galeria no Supabase', error);
      return { success: false, error: 'Erro inesperado ao salvar galeria.' };
    }
  }

  async deleteGallery(galleryId: string, imageUrls: readonly string[]): Promise<RemoteResult<void>> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    try {
      const paths = imageUrls
        .map(url => this.extractStoragePath(url))
        .filter((path): path is string => Boolean(path));

      if (paths.length > 0) {
        await this.removeFromStorage(paths);
      }

      const imagesResponse = await this.restRequest(
        `gallery_images?gallery_id=eq.${encodeURIComponent(galleryId)}`,
        { method: 'DELETE' },
      );

      if (!imagesResponse.ok) {
        this.logFailure('Falha ao remover imagens associadas no Supabase', await imagesResponse.text());
        return { success: false, error: await this.buildError(imagesResponse, 'Não foi possível remover imagens da galeria.') };
      }

      const response = await this.restRequest(`galleries?id=eq.${encodeURIComponent(galleryId)}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        this.logFailure('Falha ao excluir galeria no Supabase', await response.text());
        return { success: false, error: await this.buildError(response, 'Não foi possível excluir a galeria.') };
      }

      return { success: true };
    } catch (error) {
      this.logUnexpected('Erro inesperado ao excluir galeria no Supabase', error);
      return { success: false, error: 'Erro inesperado ao excluir galeria.' };
    }
  }

  async uploadImage(galleryId: string, dataUrl: string): Promise<RemoteResult<string>> {
    if (!this.isEnabled()) {
      return { success: true, data: dataUrl };
    }

    try {
      const { blob, extension, contentType } = this.dataUrlToBlob(dataUrl);
      const fileName = `${galleryId}/${crypto.randomUUID()}.${extension}`;

      console.log('[SupabaseService] preparando upload para o Storage', {
        contentType,
        fileName,
      });

      const uploadResponse = await this.storageRequest(
        `object/${this.bucketName}/${fileName}`,
        {
          method: 'POST',
          headers: {
            'x-upsert': 'false',
          },
          body: blob,
        },
        contentType,
      );

      if (!uploadResponse.ok) {
        this.logFailure('Falha ao enviar imagem para o Supabase Storage', await uploadResponse.text());
        return { success: false, error: await this.buildError(uploadResponse, 'Não foi possível enviar a imagem.') };
      }

      const publicUrl = `${this.baseUrl}/storage/v1/object/public/${this.bucketName}/${fileName}`;

      const imageInsertResponse = await this.restRequest('gallery_images', {
        method: 'POST',
        headers: {
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify({
          gallery_id: galleryId,
          image_url: publicUrl,
        }),
      });

      if (!imageInsertResponse.ok) {
        this.logFailure('Falha ao registrar imagem no Supabase', await imageInsertResponse.text());
        return { success: false, error: await this.buildError(imageInsertResponse, 'Não foi possível registrar a imagem.') };
      }

      const thumbnailUpdate = await this.updateGalleryThumbnail(galleryId, publicUrl);
      if (!thumbnailUpdate.success) {
        return { success: false, error: thumbnailUpdate.error };
      }

      return { success: true, data: publicUrl };
    } catch (error) {
      this.logUnexpected('Erro inesperado ao enviar imagem para o Supabase', error);
      return { success: false, error: 'Erro inesperado ao enviar imagem.' };
    }
  }

  async removeImageFromGallery(
    galleryId: string,
    imageUrl: string,
    nextThumbnail: string | undefined,
  ): Promise<RemoteResult<void>> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    try {
      const response = await this.restRequest(
        `gallery_images?gallery_id=eq.${encodeURIComponent(galleryId)}&image_url=eq.${encodeURIComponent(imageUrl)}`,
        { method: 'DELETE' },
      );

      if (!response.ok) {
        this.logFailure('Falha ao remover imagem do Supabase', await response.text());
        return { success: false, error: await this.buildError(response, 'Não foi possível remover a imagem.') };
      }

      const path = this.extractStoragePath(imageUrl);
      if (path) {
        await this.removeFromStorage([path]);
      }

      const thumbnailUpdate = await this.updateGalleryThumbnail(galleryId, nextThumbnail ?? null);
      if (!thumbnailUpdate.success) {
        return thumbnailUpdate;
      }

      return { success: true };
    } catch (error) {
      this.logUnexpected('Erro inesperado ao remover imagem do Supabase', error);
      return { success: false, error: 'Erro inesperado ao remover imagem.' };
    }
  }

  private async updateGalleryThumbnail(
    galleryId: string,
    thumbnailUrl: string | null,
  ): Promise<RemoteResult<void>> {
    if (!this.isEnabled()) {
      return { success: true };
    }

    try {
      const response = await this.restRequest(`galleries?id=eq.${encodeURIComponent(galleryId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          thumbnail_url: this.sanitizeThumbnailUrl(thumbnailUrl ?? undefined),
        }),
      });

      if (!response.ok) {
        this.logFailure('Falha ao atualizar thumbnail da galeria no Supabase', await response.text());
        return { success: false, error: await this.buildError(response, 'Não foi possível atualizar a capa da galeria.') };
      }

      return { success: true };
    } catch (error) {
      this.logUnexpected('Erro inesperado ao atualizar thumbnail no Supabase', error);
      return { success: false, error: 'Erro inesperado ao atualizar a capa da galeria.' };
    }
  }

  private async removeFromStorage(paths: readonly string[]): Promise<void> {
    if (!this.isEnabled() || paths.length === 0) {
      return;
    }

    try {
      const response = await this.storageRequest(
        `object/${this.bucketName}/delete`,
        {
          method: 'POST',
          body: JSON.stringify({ paths }),
        },
        'application/json',
      );

      if (!response.ok) {
        this.logFailure('Falha ao remover arquivos do Supabase Storage', await response.text());
      }
    } catch (error) {
      this.logUnexpected('Erro inesperado ao remover arquivos do Supabase Storage', error);
    }
  }

  private buildRestHeaders(): Record<string, string> {
    return {
      apikey: this.anonKey,
      Authorization: this.resolveAuthorizationHeader(),
      'Content-Type': 'application/json',
    };
  }

  private buildStorageHeaders(contentType?: string): Record<string, string> {
    const headers: Record<string, string> = {
      apikey: this.anonKey,
      Authorization: this.resolveAuthorizationHeader(),
    };

    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    return headers;
  }

  private resolveAuthorizationHeader(): string {
    const session = this.authService.session();
    if (session) {
      return `${session.tokenType} ${session.accessToken}`;
    }

    return `Bearer ${this.anonKey}`;
  }

  private dataUrlToBlob(dataUrl: string): { blob: Blob; extension: string; contentType: string } {
    const [header, base64Data] = dataUrl.split(',');
    const mimeMatch = header.match(/data:(.*);base64/);
    const contentType = mimeMatch?.[1] ?? 'image/png';
    const binary = atob(base64Data);
    const length = binary.length;
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: contentType });
    return {
      blob,
      contentType,
      extension: this.detectExtension(contentType),
    };
  }

  private detectExtension(contentType: string): string {
    if (contentType.includes('avif')) {
      return 'avif';
    }
    if (contentType.includes('jpeg')) {
      return 'jpg';
    }
    if (contentType.includes('png')) {
      return 'png';
    }
    if (contentType.includes('webp')) {
      return 'webp';
    }
    if (contentType.includes('gif')) {
      return 'gif';
    }
    return 'png';
  }

  private extractGalleryImageUrls(records: SupabaseGalleryImageRecord[] | null): string[] {
    if (!records) {
      return [];
    }

    return [...records]
      .filter(record => typeof record.image_url === 'string' && record.image_url.length > 0)
      .sort((a, b) => this.parseTimestamp(b.created_at) - this.parseTimestamp(a.created_at))
      .map(record => record.image_url as string);
  }

  private parseTimestamp(value: string | null): number {
    if (!value) {
      return Number.NEGATIVE_INFINITY;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
  }

  private extractStoragePath(publicUrl: string): string | null {
    try {
      const url = new URL(publicUrl);
      const prefix = `/storage/v1/object/public/${this.bucketName}/`;

      if (url.pathname.startsWith(prefix)) {
        return decodeURIComponent(url.pathname.slice(prefix.length));
      }

      const bucketIndex = url.pathname.indexOf(`/${this.bucketName}/`);
      if (bucketIndex !== -1) {
        return decodeURIComponent(url.pathname.slice(bucketIndex + this.bucketName.length + 2));
      }

      return null;
    } catch {
      return null;
    }
  }

  private parseDate(date: string | undefined): string | null {
    if (!date) {
      return null;
    }

    const [day, month, year] = date.split('/').map(part => Number.parseInt(part, 10));
    if (
      Number.isNaN(day) ||
      Number.isNaN(month) ||
      Number.isNaN(year)
    ) {
      return null;
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  private formatDate(input: string | null): string {
    if (!input) {
      return this.formatDateFromDate(new Date());
    }

    const parsed = new Date(input);
    if (Number.isNaN(parsed.getTime())) {
      return input;
    }

    return this.formatDateFromDate(parsed);
  }

  private formatDateFromDate(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  private sanitizeThumbnailUrl(url: string | undefined | null): string | null {
    if (!url || url.startsWith('data:')) {
      return null;
    }
    return url;
  }
}
