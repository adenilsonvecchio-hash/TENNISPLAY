import React, { useState } from 'react';
import { Partida, AuthSession } from '../types';
import { DbService } from '../lib/db';
import { formatAvatarUrlWithCacheBust } from '../lib/avatarImage';
import { toast } from '../lib/toast';
import {
  Trophy,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Calendar,
  Clock,
  MapPin,
  Camera
} from 'lucide-react';

interface ConfirmarResultadoModalProps {
  partida: Partida;
  session: AuthSession;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const formatPlayerName = (name?: string | null): string => {
  if (!name) return 'Jogador';
  return name
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const ConfirmarResultadoModal: React.FC<ConfirmarResultadoModalProps> = ({
  partida,
  session,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { user, activeGroup } = session;
  const currentMember = session.membros.find((m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id);
  const isAdminOrOwner = currentMember?.perfil === 'PROPRIETARIO' || currentMember?.perfil === 'ADMINISTRADOR';

  const [isConfirming, setIsConfirming] = useState(false);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionReason, setCorrectionReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [j1ImgError, setJ1ImgError] = useState(false);
  const [j2ImgError, setJ2ImgError] = useState(false);

  if (!isOpen || !user || !activeGroup) return null;

  const rawJ1Name = partida.jogador_1?.nome || 'Jogador 1';
  const rawJ2Name = partida.jogador_2?.nome || 'Jogador 2';
  const j1Name = formatPlayerName(rawJ1Name);
  const j2Name = formatPlayerName(rawJ2Name);

  const j1Photo = partida.jogador_1?.foto_url
    ? formatAvatarUrlWithCacheBust(partida.jogador_1.foto_url)
    : null;
  const j2Photo = partida.jogador_2?.foto_url
    ? formatAvatarUrlWithCacheBust(partida.jogador_2.foto_url)
    : null;

  const j1Initial = (j1Name.trim().charAt(0) || '1').toUpperCase();
  const j2Initial = (j2Name.trim().charAt(0) || '2').toUpperCase();

  const isUserJ1 = user.id === partida.jogador_1_id;
  const isUserJ2 = user.id === partida.jogador_2_id;

  const winner = partida.vencedor?.nome
    ? formatPlayerName(partida.vencedor.nome)
    : (partida.vencedor_id === partida.jogador_1_id ? j1Name : j2Name);

  const handleConfirm = async () => {
    setIsConfirming(true);
    setErrorMessage(null);

    try {
      await DbService.confirmMatchResult(partida.id, user.id, isAdminOrOwner);
      toast.success('Resultado confirmado com sucesso! Suas estatísticas foram atualizadas.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao confirmar resultado:', err);
      setErrorMessage(err.message || 'Erro ao confirmar resultado.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCorrecting(true);
    setErrorMessage(null);

    try {
      await DbService.requestScoreCorrection(partida.id, user.id, correctionReason.trim());
      toast.success('Solicitação de correção enviada ao adversário.');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao solicitar correção:', err);
      setErrorMessage(err.message || 'Erro ao solicitar correção.');
    } finally {
      setIsCorrecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* HEADER */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              🏆
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Conferir Resultado</h2>
              <p className="text-xs text-slate-400 font-medium truncate max-w-[240px]">
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
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* PLAYERS CARD COM FOTOS */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
            {/* JOGADOR 1 */}
            <div className="flex flex-col items-center justify-between min-w-0 space-y-2">
              <div className="flex flex-col items-center space-y-1.5 w-full">
                <div className="relative w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] shrink-0">
                  {j1Photo && !j1ImgError ? (
                    <img
                      src={j1Photo}
                      alt={j1Name}
                      onError={() => setJ1ImgError(true)}
                      className="w-full h-full rounded-full object-cover object-center border-[3px] border-[#0F172A] shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-[#0F172A] text-white border-[3px] border-[#0F172A] flex items-center justify-center font-black text-lg sm:text-xl shadow-xs">
                      {j1Initial}
                    </div>
                  )}
                </div>
                <div className="w-full px-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Jogador 1 {isUserJ1 && '(Você)'}
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 line-clamp-2 break-words leading-tight mt-0.5 text-center">
                    {j1Name}
                  </h3>
                </div>
              </div>
            </div>

            {/* JOGADOR 2 */}
            <div className="flex flex-col items-center justify-between min-w-0 space-y-2">
              <div className="flex flex-col items-center space-y-1.5 w-full">
                <div className="relative w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] shrink-0">
                  {j2Photo && !j2ImgError ? (
                    <img
                      src={j2Photo}
                      alt={j2Name}
                      onError={() => setJ2ImgError(true)}
                      className="w-full h-full rounded-full object-cover object-center border-[3px] border-[#ccff00] shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-slate-900 text-[#ccff00] border-[3px] border-[#ccff00] flex items-center justify-center font-black text-lg sm:text-xl shadow-xs">
                      {j2Initial}
                    </div>
                  )}
                </div>
                <div className="w-full px-1">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                    Jogador 2 {isUserJ2 && '(Você)'}
                  </span>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 line-clamp-2 break-words leading-tight mt-0.5 text-center">
                    {j2Name}
                  </h3>
                </div>
              </div>
            </div>
          </div>

          {/* PLACAR DOS SETS EM DESTAQUE */}
          <div className="p-5 rounded-3xl bg-slate-900 text-white text-center space-y-3 shadow-lg">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#ccff00]">
              Placar Informado
            </span>
            
            <div className="text-2xl font-black tracking-tight">
              {partida.sets && partida.sets.length > 0 ? (
                <div className="flex items-center justify-center gap-3">
                  {partida.sets.map((s, idx) => (
                    <div key={idx} className="bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700">
                      <span className="text-xs text-slate-400 block font-bold mb-0.5">Set {s.numero_set}</span>
                      <span className="text-lg font-black text-white">{s.jogador_1_games} × {s.jogador_2_games}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xl font-bold">{partida.detalhes_placar || 'Sem detalhes'}</p>
              )}
            </div>

            {/* SE O USUÁRIO FOR JOGADOR 2, EXIBE TAMBÉM NA PERSPECTIVA DELE */}
            {isUserJ2 && partida.sets && partida.sets.length > 0 && (
              <p className="text-xs text-slate-400 font-bold">
                Na sua perspectiva:{' '}
                <span className="text-white font-black">
                  {partida.sets
                    .slice()
                    .sort((a, b) => a.numero_set - b.numero_set)
                    .map((s) => `${s.jogador_2_games}×${s.jogador_1_games}`)
                    .join(' / ')}
                </span>
              </p>
            )}

            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-center gap-2 text-amber-300 text-xs font-black">
              <Trophy className="w-4 h-4" />
              <span>Vencedor: {winner}</span>
            </div>
          </div>

          {/* FOTO DA PARTIDA (SE HOUVER) */}
          {partida.foto_url && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video shadow-xs relative">
              <img
                src={partida.foto_url}
                alt="Foto da partida"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute bottom-2 left-2 px-2.5 py-1 rounded-lg bg-slate-950/70 text-white text-[10px] font-bold flex items-center gap-1">
                <Camera className="w-3 h-3" />
                <span>Foto registrada</span>
              </div>
            </div>
          )}

          {/* INFORMAÇÕES DO JOGO */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
            {partida.reserva && (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-400">Data:</span>
                  <span className="font-extrabold text-slate-800">{partida.reserva.data}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-400">Horário:</span>
                  <span className="font-extrabold text-slate-800">{partida.reserva.horario_label}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-400">Quadra:</span>
                  <span className="font-extrabold text-slate-800">Quadra {partida.reserva.quadra_numero}</span>
                </div>
              </>
            )}
          </div>

          {/* FORMULÁRIO DE CONTESTAÇÃO (SE CLICADO) */}
          {showCorrectionForm ? (
            <form onSubmit={handleRequestCorrection} className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-700" />
                  Motivo da Divergência
                </span>
                <button
                  type="button"
                  onClick={() => setShowCorrectionForm(false)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-700"
                >
                  Voltar
                </button>
              </div>

              <textarea
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
                placeholder="Ex: O 2º set terminou 6x4 e não 6x2..."
                rows={2}
                className="w-full p-2.5 rounded-xl bg-white border border-amber-300 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />

              <button
                type="submit"
                disabled={isCorrecting}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCorrecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Enviar Solicitação de Correção'}
              </button>
            </form>
          ) : (
            /* ACTIONS */
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isConfirming}
                className="w-full py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CONFIRMAR RESULTADO</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowCorrectionForm(true)}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                <span>Solicitar Correção do Placar</span>
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};

