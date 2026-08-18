import { getSupabaseClient } from './supabase';

export const PLAYER_AVATARS_BUCKET = 'avatars';

export interface ProcessAvatarOptions {
  maxDimension?: number;
  quality?: number;
}

export function validateAvatarFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Nenhum arquivo selecionado.' };
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

  if (!allowedTypes.includes(file.type.toLowerCase()) && !isAllowedExt) {
    return {
      valid: false,
      error: 'Formato de arquivo inválido. Selecione uma imagem nos formatos JPG, PNG ou WebP.'
    };
  }

  const maxSizeInBytes = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxSizeInBytes) {
    return {
      valid: false,
      error: 'A imagem excede o tamanho máximo permitido de 5 MB.'
    };
  }

  return { valid: true };
}

export async function convertImageToWebp(
  imageSource: File | Blob | string,
  options: ProcessAvatarOptions = {}
): Promise<Blob> {
  const maxDim = options.maxDimension || 800;
  const quality = options.quality || 0.90;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrl: string | null = null;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize proportional if larger than maxDim
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          reject(new Error('Erro ao processar gráfico da imagem.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve(blob);
            } else {
              // Fallback to original file if blob creation fails
              if (imageSource instanceof File || imageSource instanceof Blob) {
                resolve(imageSource);
              } else {
                reject(new Error('Não foi possível converter a imagem para WebP.'));
              }
            }
          },
          'image/webp',
          quality
        );
      } catch (err) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        // Fallback to original
        if (imageSource instanceof File || imageSource instanceof Blob) {
          resolve(imageSource);
        } else {
          reject(err);
        }
      }
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Erro ao ler a imagem selecionada.'));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      objectUrl = URL.createObjectURL(imageSource);
      img.src = objectUrl;
    }
  });
}

export function formatAvatarUrlWithCacheBust(url?: string | null): string | null {
  if (!url) return null;
  const cleanUrl = url.split('?')[0];
  return `${cleanUrl}?v=${Date.now()}`;
}
