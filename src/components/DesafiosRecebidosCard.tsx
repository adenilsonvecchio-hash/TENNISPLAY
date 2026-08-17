import React, { useState, useEffect } from 'react';
import { Partida } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import { Calendar, Clock, Swords, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';

interface DesafiosRecebidosCardProps {
  challenges?: Partida[];
  currentUserId?: string;
  userId?: string;
  groupId?: string;
  onAccept?: (matchId: string) => Promise<void>;
  onReject?: (matchId: string, motivo?: string) => Promise<void>;
  onChallengeUpdated?: () => void;
  compact?: boolean;
}

export const DesafiosRecebidosCard: React.FC<DesafiosRecebidosCardProps> = ({
  challenges: initialChallenges,
  currentUserId,
  userId,
  groupId,
  onAccept,
  onReject,
  onChallengeUpdated,
  compact = false
}) => {
  const effectiveUserId = currentUserId || userId || '';
  const [internalChallenges, setInternalChallenges] = useState<Partida[]>(initialChallenges || []);
  const [fetchError, setFetchError] = useState<any>(null);
  const [loadingMatchId, setLoadingMatchId] = useState<string | null>(null);
  const [rejectingMatch, setRejectingMatch] = useState<Partida | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Sincronizar quando challenges forem passados via prop
  useEffect(() => {
    if (initialChallenges !== undefined) {
      setInternalChallenges(initialChallenges);
    }
  }, [initialChallenges]);

  // Se não vier challenges prontos e tivermos userId, buscar diretamente
  const fetchChallenges = async () => {
    if (!effectiveUserId) return;
    try {
      setFetchError(null);
      const list = await DbService.getPendingChallenges(effectiveUserId, groupId);
      setInternalChallenges(list);
    } catch (err: any) {
      console.error('[DESAFIOS CARD Error]:', err);
      setFetchError(err);
    }
  };

  useEffect(() => {
    if (initialChallenges === undefined && effectiveUserId) {
      fetchChallenges();
    }
  }, [effectiveUserId, groupId, initialChallenges]);

  const activeChallenges = initialChallenges !== undefined ? initialChallenges : internalChallenges;

  // Log de diagnóstico obrigatório
  useEffect(() => {
    console.log('[DESAFIOS CARD]', {
      userId: effectiveUserId,
      groupId,
      desafios: activeChallenges,
      error: fetchError
    });
  }, [effectiveUserId, groupId, activeChallenges, fetchError]);

  if (!activeChallenges || activeChallenges.length === 0) return null;

  const handleAcceptClick = async (matchId: string) => {
    try {
      setLoadingMatchId(matchId);
      if (onAccept) {
        await onAccept(matchId);
      } else {
        await DbService.acceptChallenge(matchId, effectiveUserId);
        toast.success('Desafio aceito com sucesso! O jogo está confirmado na sua agenda. 🎾');
        await fetchChallenges();
        if (onChallengeUpdated) onChallengeUpdated();
      }
    } catch (err: any) {
      console.error('[DESAFIOS CARD Accept Error]:', err);
      toast.error(err.message || 'Erro ao aceitar desafio.');
    } finally {
      setLoadingMatchId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingMatch) return;
    try {
      setLoadingMatchId(rejectingMatch.id);
      if (onReject) {
        await onReject(rejectingMatch.id, rejectReason || undefined);
      } else {
        await DbService.rejectChallenge(rejectingMatch.id, effectiveUserId, rejectReason || undefined);
        toast.success('Desafio recusado. A quadra e horário foram liberados.');
        await fetchChallenges();
        if (onChallengeUpdated) onChallengeUpdated();
      }
      setRejectingMatch(null);
      setRejectReason('');
    } catch (err: any) {
      console.error('[DESAFIOS CARD Reject Error]:', err);
      toast.error(err.message || 'Erro ao recusar desafio.');
    } finally {
      setLoadingMatchId(null);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Data a definir';
    const today = new Date().toISOString().split('T')[0];
    if (dateStr === today) return 'Hoje';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shadow-xs">
            🎾
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-2">
              <span>Desafios Recebidos</span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-black animate-pulse">
                {activeChallenges.length} {activeChallenges.length === 1 ? 'pendente' : 'pendentes'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Outros jogadores marcaram um jogo com você. Responda para confirmar a agenda.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {activeChallenges.map((match) => {
          const challenger = match.jogador_1;
          const challengerName = challenger?.nome || 'Um jogador';
          const challengerPhoto = challenger?.avatar_url || challenger?.foto_url;
          const challengerClass = match.jogador_1_classe;
          const dateLabel = formatDate(match.reserva?.data);
          const timeLabel = match.reserva?.horario_label || (match.reserva?.horario?.hora_inicio ? `${match.reserva.horario.hora_inicio.substring(0, 5)} - ${match.reserva.horario.hora_fim?.substring(0, 5)}` : 'Horário a definir');
          const courtLabel = match.reserva?.quadra ? `Quadra ${match.reserva.quadra.numero} (${match.reserva.quadra.nome})` : `Quadra ${match.reserva?.quadra_numero || 1}`;

          const isProcessing = loadingMatchId === match.id;

          return (
            <div
              key={match.id}
              className="bg-white rounded-3xl p-5 border-2 border-amber-300/80 shadow-md hover:shadow-lg transition-all flex flex-col justify-between relative overflow-hidden bg-gradient-to-br from-amber-50/50 via-white to-white"
            >
              {/* Top Banner Tag */}
              <div className="flex items-center justify-between gap-2 mb-3.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 uppercase tracking-tight shadow-2xs">
                  <Swords className="w-3 h-3" />
                  Desafio Aguardando Seu Aceite
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {new Date(match.criado_em).toLocaleDateString('pt-BR')}
                </span>
              </div>

              {/* Challenger Info */}
              <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs mb-3.5">
                <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-base shrink-0 overflow-hidden shadow-inner border border-slate-100">
                  {challengerPhoto ? (
                    <img
                      src={challengerPhoto}
                      alt={challengerName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span>{challengerName.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-extrabold uppercase text-amber-700 tracking-wider block">
                    Desafiante
                  </span>
                  <h4 className="text-sm font-black text-slate-900 truncate">
                    {challengerName} desafiou você
                  </h4>
                  {challengerClass && (
                    <span className="inline-block mt-0.5 text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      Classe {challengerClass}
                    </span>
                  )}
                </div>
              </div>

              {/* Match Details Grid */}
              <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs mb-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Data</span>
                    <span className="font-extrabold text-slate-800">{dateLabel}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Horário</span>
                    <span className="font-extrabold text-slate-800 truncate">{timeLabel}</span>
                  </div>
                </div>
                <div className="col-span-2 flex items-center gap-2 pt-1 border-t border-slate-200/60">
                  <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0">
                    🎾
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block">Local</span>
                    <span className="font-extrabold text-slate-800">{courtLabel}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleAcceptClick(match.id)}
                  className="py-2.5 px-3 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#ccff00]" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#ccff00]" />
                      <span>Aceitar</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setRejectingMatch(match)}
                  className="py-2.5 px-3 rounded-2xl bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4 text-rose-500" />
                  <span>Recusar</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE CONFIRMAÇÃO DE RECUSA (SEM window.confirm) */}
      {rejectingMatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-black text-slate-900">Recusar Desafio?</h4>
                <p className="text-xs text-slate-500">
                  O horário e a quadra serão liberados imediatamente.
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              Você está recusando o desafio de{' '}
              <strong className="font-extrabold text-slate-900">
                {rejectingMatch.jogador_1?.nome || 'seu adversário'}
              </strong>{' '}
              para o dia{' '}
              <strong className="font-extrabold text-slate-900">
                {formatDate(rejectingMatch.reserva?.data)}
              </strong>
              .
            </p>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600">
                Motivo (opcional):
              </label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">Selecione um motivo (ou deixe em branco)</option>
                <option value="Conflito de horário">Conflito de horário</option>
                <option value="Indisposição ou lesão">Indisposição ou lesão</option>
                <option value="Compromisso pessoal">Compromisso pessoal</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectingMatch(null);
                  setRejectReason('');
                }}
                disabled={loadingMatchId === rejectingMatch.id}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={loadingMatchId === rejectingMatch.id}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {loadingMatchId === rejectingMatch.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                <span>Confirmar Recusa</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

