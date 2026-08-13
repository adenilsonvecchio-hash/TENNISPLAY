import { getSupabaseClient } from './supabase';

export interface ProcessImageOptions {
  maxDimension?: number;
  quality?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
}

export function validateGroupImageFile(file: File): { valid: boolean; error?: string } {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
  
  // Extension fallback check
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isAllowedExt = ['jpg', 'jpeg', 'png', 'webp'].includes(ext);

  if (!allowedTypes.includes(file.type.toLowerCase()) && !isAllowedExt) {
    return {
      valid: false,
      error: 'Formato de arquivo inválido. Permito apenas JPG, PNG ou WebP.'
    };
  }

  const maxSizeInBytes = 3 * 1024 * 1024; // 3 MB
  if (file.size > maxSizeInBytes) {
    return {
      valid: false,
      error: 'Tamanho máximo permitido: 3 MB.'
    };
  }

  return { valid: true };
}

export async function processAndCropImage(
  imageSource: File | string,
  options: ProcessImageOptions = {}
): Promise<Blob> {
  const maxDim = options.maxDimension || 800;
  const quality = options.quality || 0.88;
  const scale = options.scale || 1;
  const offsetX = options.offsetX || 0;
  const offsetY = options.offsetY || 0;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    let objectUrl: string | null = null;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = maxDim;
        canvas.height = maxDim;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Erro ao processar gráfico da imagem.'));
          return;
        }

        ctx.fillStyle = '#0F172A';
        ctx.fillRect(0, 0, maxDim, maxDim);

        // Aspect ratio calculations
        const srcAspect = img.width / img.height;
        let drawW = maxDim;
        let drawH = maxDim;

        if (srcAspect > 1) {
          drawW = maxDim * srcAspect;
        } else {
          drawH = maxDim / srcAspect;
        }

        drawW *= scale;
        drawH *= scale;

        const startX = (maxDim - drawW) / 2 + (offsetX * (maxDim / 200));
        const startY = (maxDim - drawH) / 2 + (offsetY * (maxDim / 200));

        ctx.drawImage(img, startX, startY, drawW, drawH);

        canvas.toBlob(
          (blob) => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Não foi possível gerar arquivo de imagem.'));
            }
          },
          'image/webp',
          quality
        );
      } catch (err) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Erro ao carregar os dados da imagem.'));
    };

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else {
      objectUrl = URL.createObjectURL(imageSource);
      img.src = objectUrl;
    }
  });
}

export function getGroupPublicImageUrl(imagemPath?: string | null): string | null {
  if (!imagemPath) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = supabase.storage
    .from('group-avatars')
    .getPublicUrl(imagemPath);

  if (!data?.publicUrl) return null;
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function uploadGroupImageToStorage(
  groupId: string,
  imageBlob: Blob
): Promise<{ filePath: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Cliente Supabase não inicializado');
  }

  const filePath = `${groupId}/avatar.webp`;

  const { error: uploadError } = await supabase.storage
    .from('group-avatars')
    .upload(filePath, imageBlob, {
      contentType: 'image/webp',
      upsert: true,
      cacheControl: '3600'
    });

  if (uploadError) {
    console.error('[Supabase Storage Upload Error]:', uploadError);
    throw uploadError;
  }

  return { filePath };
}

export async function removeGroupImageFromStorage(groupId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const filePath = `${groupId}/avatar.webp`;

  try {
    await supabase.storage.from('group-avatars').remove([filePath]);
  } catch (err) {
    console.warn('[Supabase Storage Remove Warning]:', err);
  }
}
