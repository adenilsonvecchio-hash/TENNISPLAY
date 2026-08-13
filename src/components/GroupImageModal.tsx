import React, { useState, useRef, useEffect } from 'react';
import { Grupo } from '../types';
import { toast } from '../lib/toast';
import { getSupabaseClient } from '../lib/supabase';
import {
  validateGroupImageFile,
  processAndCropImage,
  getGroupPublicImageUrl
} from '../lib/groupImage';
import { X, Upload, Trash2, ZoomIn, Image as ImageIcon, Loader2, RefreshCw } from 'lucide-react';

interface GroupImageModalProps {
  group: Grupo;
  isOpen: boolean;
  onClose: () => void;
  onRefreshSession: () => Promise<void> | void;
}

export function GroupImageModal({
  group,
  isOpen,
  onClose,
  onRefreshSession
}: GroupImageModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(
    getGroupPublicImageUrl(group.imagem_path) || group.logo_url || null
  );
  const [scale, setScale] = useState<number>(1);
  const [offsetX, setOffsetX] = useState<number>(0);
  const [offsetY, setOffsetY] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setPreviewSrc(getGroupPublicImageUrl(group.imagem_path) || group.logo_url || null);
      setScale(1);
      setOffsetX(0);
      setOffsetY(0);
      setIsSaving(false);
      setIsRemoving(false);
    }
  }, [isOpen, group.imagem_path, group.logo_url]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateGroupImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo de imagem inválido.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc(objectUrl);
    setScale(1);
    setOffsetX(0);
    setOffsetY(0);
  };

  const handleSave = async () => {
    if (!previewSrc && !selectedFile) {
      toast.error('Nenhuma imagem selecionada.');
      return;
    }

    setIsSaving(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error('Não foi possível conectar ao Supabase.');
      setIsSaving(false);
      return;
    }

    const imagePath = `${group.id}/avatar.webp`;

    try {
      const source = selectedFile || previewSrc!;
      const processedBlob = await processAndCropImage(source, {
        maxDimension: 800,
        quality: 0.88,
        scale,
        offsetX,
        offsetY
      });

      // 1. Upload image to bucket
      const { error: uploadError } = await supabase.storage
        .from('group-avatars')
        .upload(imagePath, processedBlob, {
          contentType: 'image/webp',
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) {
        console.error('[Supabase Storage Upload Error]:', uploadError);
        throw uploadError;
      }

      // 2. Update public.grupos.imagem_path
      const { data, error: dbError } = await supabase
        .from('grupos')
        .update({ imagem_path: imagePath })
        .eq('id', group.id)
        .select('id, imagem_path')
        .single();

      if (dbError) {
        console.error('Erro ao atualizar imagem_path:', {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint
        });

        // Cleanup uploaded file on DB error
        try {
          await supabase.storage.from('group-avatars').remove([imagePath]);
        } catch (cleanErr) {
          console.warn('Erro ao remover arquivo do storage após falha no banco:', cleanErr);
        }
        throw dbError;
      }

      if (!data || data.imagem_path !== imagePath) {
        throw new Error('Confirmação do banco para imagem_path falhou.');
      }

      // 3. Refresh session and toast success
      await onRefreshSession();
      toast.success('Imagem do grupo atualizada com sucesso.');
      onClose();
    } catch (err: any) {
      console.error('[GroupImageModal Save Error]:', err);
      toast.error('Não foi possível atualizar a imagem do grupo. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Tem certeza que deseja remover a imagem personalizada do grupo?')) return;

    setIsRemoving(true);
    const supabase = getSupabaseClient();
    if (!supabase) {
      toast.error('Não foi possível conectar ao Supabase.');
      setIsRemoving(false);
      return;
    }

    const imagePath = `${group.id}/avatar.webp`;

    try {
      try {
        await supabase.storage.from('group-avatars').remove([imagePath]);
      } catch (storageErr) {
        console.warn('[Supabase Storage Remove Warning]:', storageErr);
      }

      const { data, error: dbError } = await supabase
        .from('grupos')
        .update({ imagem_path: null })
        .eq('id', group.id)
        .select('id, imagem_path')
        .single();

      if (dbError) {
        console.error('Erro ao atualizar imagem_path:', {
          message: dbError.message,
          code: dbError.code,
          details: dbError.details,
          hint: dbError.hint
        });
        throw dbError;
      }

      await onRefreshSession();
      toast.success('Imagem do grupo atualizada com sucesso.');
      onClose();
    } catch (err: any) {
      console.error('[GroupImageModal Remove Error]:', err);
      toast.error('Não foi possível atualizar a imagem do grupo. Tente novamente.');
    } finally {
      setIsRemoving(false);
    }
  };

  const hasCustomImage = Boolean(group.imagem_path || group.logo_url || selectedFile);

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 relative space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
              <ImageIcon className="w-5 h-5 text-[#0F172A]" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-base">Alterar imagem do grupo</h3>
              <p className="text-xs text-slate-500 font-medium">{group.nome}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving || isRemoving}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Image Preview & Crop Stage */}
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-2xl overflow-hidden bg-slate-900 border-2 border-dashed border-slate-300 flex items-center justify-center shadow-inner group">
            {previewSrc ? (
              <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                <img
                  src={previewSrc}
                  alt="Pré-visualização"
                  style={{
                    transform: `scale(${scale}) translate(${offsetX}px, ${offsetY}px)`,
                    transition: isSaving ? 'none' : 'transform 0.05s linear'
                  }}
                  className="max-w-none w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="text-center p-4">
                <span className="text-5xl block mb-2">🎾</span>
                <p className="text-xs font-bold text-slate-400">Nenhuma imagem personalizada</p>
              </div>
            )}
          </div>

          {/* Escolher Imagem Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSaving || isRemoving}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-black flex items-center gap-2 transition-all cursor-pointer border border-slate-200 shadow-2xs"
          >
            <Upload className="w-4 h-4 text-slate-700" />
            <span>Escolher imagem</span>
          </button>

          <p className="text-[11px] text-slate-500 text-center font-medium">
            Formatos aceitos: <strong>JPG, PNG, WebP</strong> (Máx. 3 MB)
          </p>

          {/* Reposition & Zoom Controls (if an image is loaded) */}
          {previewSrc && (
            <div className="w-full bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-1.5">
                  <ZoomIn className="w-4 h-4 text-slate-500" />
                  Ajustar Zoom
                </span>
                <span className="text-slate-500 font-mono">{scale.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Horizontal
                  </label>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={offsetX}
                    onChange={(e) => setOffsetX(parseInt(e.target.value))}
                    className="w-full accent-slate-700 cursor-pointer h-1 bg-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                    Vertical
                  </label>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={offsetY}
                    onChange={(e) => setOffsetY(parseInt(e.target.value))}
                    className="w-full accent-slate-700 cursor-pointer h-1 bg-slate-200 rounded-lg"
                  />
                </div>
              </div>

              {(scale !== 1 || offsetX !== 0 || offsetY !== 0) && (
                <button
                  type="button"
                  onClick={() => {
                    setScale(1);
                    setOffsetX(0);
                    setOffsetY(0);
                  }}
                  className="text-[10px] font-extrabold text-slate-500 hover:text-slate-900 flex items-center gap-1 mx-auto cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  Redefinir Posição
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || isRemoving || !previewSrc}
              className="flex-1 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>Salvar imagem</span>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSaving || isRemoving}
              className="py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs cursor-pointer transition-all"
            >
              Cancelar
            </button>
          </div>

          {hasCustomImage && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={isSaving || isRemoving}
              className="w-full py-2.5 px-4 rounded-2xl text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
            >
              {isRemoving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Removendo...</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover imagem</span>
                </>
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
