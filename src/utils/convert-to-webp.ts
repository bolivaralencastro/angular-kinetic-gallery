const WEBP_MIME = 'image/webp';

export async function convertToWebp(blob: Blob): Promise<{ blob: Blob; extension: string; mime: string }> {
  const fallbackMime = blob.type || 'image/png';
  const fallback = {
    blob,
    extension: detectExtension(fallbackMime),
    mime: fallbackMime,
  } as const;

  if (typeof document === 'undefined') {
    return fallback;
  }

  try {
    const image = await loadImage(blob);
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;

    const context = canvas.getContext('2d');
    if (!context) {
      return fallback;
    }

    context.drawImage(image, 0, 0);

    const webpBlob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(result => resolve(result), WEBP_MIME, 0.8);
    });

    if (webpBlob && webpBlob.size > 0) {
      console.info('[convertToWebp] usando WEBP, tamanho:', webpBlob.size);
      return {
        blob: webpBlob,
        extension: 'webp',
        mime: WEBP_MIME,
      };
    }
  } catch (error) {
    console.warn('Falha ao converter imagem para WEBP', error);
  }

  console.warn('[convertToWebp] fallback ativado, mantendo formato original:', fallbackMime);
  return fallback;
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(blob);

  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Não foi possível carregar a imagem para conversão.'));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function detectExtension(mime: string): string {
  if (mime.includes('webp')) {
    return 'webp';
  }
  if (mime.includes('avif')) {
    return 'avif';
  }
  if (mime.includes('jpeg')) {
    return 'jpg';
  }
  if (mime.includes('png')) {
    return 'png';
  }
  if (mime.includes('gif')) {
    return 'gif';
  }
  return 'png';
}
