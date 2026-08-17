import React, { useState } from 'react';
import { Partida, AuthSession } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import {
  Trophy,
  Camera,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';

interface InformarResultadoModalProps {
  partida: Partida;
  session: AuthSession;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface SetRow {
  numero_set: number;
  j1Games: number;
  j2Games: number;
}

export const InformarResultadoModal: React.FC<InformarResultadoModalProps> = ({
  partida,
  session,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, activeGroup } = session;
  const currentMember = session.membros.find((m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id);
  const isAdminOrOwner = currentMember?.perfil === 'PROPRIETARIO' || currentMember?.perfil === 'ADMINISTRADOR';

  const [sets, setSets] = useState<SetRow[]>([
    { numero_set: 1, j1Games: 6, j2Games: 4 },
    { numero_set: 2, j1Games: 6, j2Games: 3 }
  ]);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(partida.foto_url || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !user || !activeGroup) return null;

  const j1Name = partida.jogador_1?.nome || 'Jogador 1';
  const j2Name = partida.jogador_2?.nome || 'Jogador 2';

  // Contagem de sets ganhos
  let setsJ1 = 0;
  let setsJ2 = 0;
  sets.forEach((s) => {
    if (s.j1Games > s.j2Games) setsJ1++;
    else if (s.j2Games > s.j1Games) setsJ2++;
  });

  const winnerName = setsJ1 > setsJ2 ? j1Name : setsJ2 > setsJ1 ? j2Name : null;
  const isTie = setsJ1 === setsJ2 && sets.length > 0;

  const handleAddSet = () => {
    if (sets.length >= 5) return;
    setSets([...sets, { numero_set: sets.length + 1, j1Games: 0, j2Games: 0 }]);
  };

  const handleRemoveSet = (index: number) => {
    if (sets.length <= 1) return;
    const newSets = sets.filter((_, i) => i !== index).map((s, i) => ({ ...s, numero_set: i + 1 }));
    setSets(newSets);
  };

  const handleGameChange = (index: number, player: 1 | 2, value: number) => {
    const safeVal = Math.max(0, Math.min(99, Math.floor(value || 0)));
    const newSets = [...sets];
    if (player === 1) newSets[index].j1Games = safeVal;
    else newSets[index].j2Games = safeVal;
    setSets(newSets);
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isTie || !winnerName) {
      setErrorMessage('O placar não pode estar empatado. É necessário um vencedor.');
      return;
    }

    setIsSubmitting(true);

    try {
      let uploadedUrl: string | undefined = partida.foto_url || undefined;
      let uploadedPath: string | undefined = partida.foto_path || undefined;

      if (photoFile) {
        try {
          const res = await DbService.uploadMatchPhoto(photoFile, activeGroup.id, partida.id);
          uploadedUrl = res.publicUrl;
          uploadedPath = res.path;
        } catch (uploadErr: any) {
          console.warn('Falha no upload da foto, prosseguindo com o resultado:', uploadErr);
        }
      } else if (photoPreview === null && partida.foto_url) {
        uploadedUrl = undefined;
        uploadedPath = undefined;
      }

      await DbService.submitMatchScore({
        matchId: partida.id,
        userId: user.id,
        sets: sets.map((s) => ({
          numero_set: s.numero_set,
          jogador_1_games: s.j1Games,
          jogador_2_games: s.j2Games
        })),
        fotoUrl: uploadedUrl,
        fotoPath: uploadedPath,
        isAdminOrOwner
      });

      toast.success(
        isAdminOrOwner
          ? 'Resultado e placar oficializados com sucesso!'
          : 'Resultado enviado! Seu adversário foi notificado para confirmar.'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar resultado:', err);
      setErrorMessage(err.message || 'Erro ao registrar resultado da partida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#ccff00] text-slate-950 flex items-center justify-center font-black">
              🎾
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Resultado da Partida</h2>
              <p className="text-xs text-slate-400 font-medium truncate max-w-[280px]">
                {j1Name} × {j2Name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PLAYERS CARD */}
          <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Jogador 1</span>
              <p className="text-sm font-black text-slate-900 truncate">{j1Name}</p>
              <span className="inline-block mt-1 text-xs font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {setsJ1} {setsJ1 === 1 ? 'set' : 'sets'}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-slate-400">Jogador 2</span>
              <p className="text-sm font-black text-slate-900 truncate">{j2Name}</p>
              <span className="inline-block mt-1 text-xs font-black px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                {setsJ2} {setsJ2 === 1 ? 'set' : 'sets'}
              </span>
            </div>
          </div>

          {/* SETS INPUT */}
          <div className="space-y-3">
            <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center justify-between">
              <span>Placar por Set</span>
              <span className="text-[11px] font-semibold text-slate-400">Games ganhos</span>
            </label>

            <div className="space-y-2.5">
              {sets.map((set, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/80 border border-slate-200 gap-3"
                >
                  <span className="text-xs font-black text-slate-600 w-12 shrink-0">
                    Set {set.numero_set}
                  </span>

                  {/* Games J1 */}
                  <div className="flex-1 flex items-center justify-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={set.j1Games}
                      onChange={(e) => handleGameChange(idx, 1, parseInt(e.target.value) || 0)}
                      className="w-14 h-11 text-center font-black text-lg bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                    />
                    <span className="font-bold text-slate-400 text-sm">×</span>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={set.j2Games}
                      onChange={(e) => handleGameChange(idx, 2, parseInt(e.target.value) || 0)}
                      className="w-14 h-11 text-center font-black text-lg bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#0F172A] focus:outline-none"
                    />
                  </div>

                  {sets.length > 2 && idx === sets.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveSet(idx)}
                      className="w-8 h-8 rounded-xl text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="w-8" />
                  )}
                </div>
              ))}
            </div>

            {sets.length < 3 && (
              <button
                type="button"
                onClick={handleAddSet}
                className="w-full py-2.5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-400 text-slate-700 text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer bg-slate-50/50"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar 3º Set / Tiebreak</span>
              </button>
            )}
          </div>

          {/* VENCEDOR CALCULADO AUTOMATICAMENTE */}
          <div
            className={`p-4 rounded-2xl border transition-all flex items-center gap-3 ${
              winnerName
                ? 'bg-amber-50 border-amber-200 text-amber-950'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${winnerName ? 'bg-amber-400 text-amber-950' : 'bg-slate-300 text-slate-600'}`}>
              <Trophy className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                Vencedor Automático
              </span>
              <p className="text-sm font-black">
                {winnerName ? `🏆 ${winnerName}` : isTie ? 'Placar empatado' : 'Aguardando placar'}
              </p>
            </div>
          </div>

          {/* FOTO DA PARTIDA (OPCIONAL) */}
          <div className="space-y-2.5">
            <label className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-slate-600" />
              <span>Foto do Jogo (Opcional)</span>
            </label>

            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 group aspect-video">
                <img
                  src={photoPreview}
                  alt="Foto da partida"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="px-3 py-1.5 rounded-xl bg-white text-slate-900 text-xs font-extrabold cursor-pointer hover:bg-slate-100 shadow-md">
                    Trocar Foto
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-extrabold hover:bg-rose-700 cursor-pointer shadow-md"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-slate-200/80 flex items-center justify-center text-slate-600">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-black text-slate-800">
                    Toque para adicionar uma foto
                  </span>
                  <p className="text-[11px] font-medium text-slate-400">
                    Foto após o jogo para o feed do clube (JPG ou PNG até 5MB)
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* ACTIONS */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !winnerName || isTie}
              className="flex-2 py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando Placar...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isAdminOrOwner ? 'Finalizar Partida' : 'Salvar e Enviar'}</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
