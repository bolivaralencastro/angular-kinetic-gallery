export async function convertToAvif(blob: Blob): Promise<{ blob: Blob; extension: string; mime: string }> {
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

    const avifBlob = await new Promise<Blob | null>(resolve => {
      canvas.toBlob(resolve, 'image/avif', 0.8);
    });

    if (avifBlob && avifBlob.size > 0 && avifBlob.type.includes('avif')) {
      console.info('[convertToAvif] usando AVIF, tamanho:', avifBlob.size);
      return {
        blob: avifBlob,
        extension: 'avif',
        mime: 'image/avif',
      };
    }
  } catch (error) {
    console.warn('Falha ao converter imagem para AVIF', error);
  }

  console.warn('[convertToAvif] fallback ativado, mantendo formato original:', fallbackMime);
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
  if (mime.includes('avif')) {
    return 'avif';
  }
  if (mime.includes('jpeg')) {
    return 'jpg';
  }
  if (mime.includes('png')) {
    return 'png';
  }
  if (mime.includes('webp')) {
    return 'webp';
  }
  if (mime.includes('gif')) {
    return 'gif';
  }
  return 'png';
}
