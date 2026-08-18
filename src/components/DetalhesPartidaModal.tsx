import React, { useState } from 'react';
import { Partida, AuthSession } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  X,
  Camera,
  CheckCircle2,
  AlertCircle,
  Hourglass,
  Trash2,
  Sparkles,
  Edit3
} from 'lucide-react';
import { InformarResultadoModal } from './InformarResultadoModal';
import { ConfirmarResultadoModal } from './ConfirmarResultadoModal';

interface DetalhesPartidaModalProps {
  partida: Partida;
  session: AuthSession;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const DetalhesPartidaModal: React.FC<DetalhesPartidaModalProps> = ({
  partida,
  session,
  isOpen,
  onClose,
  onRefresh
}) => {
  const { user, activeGroup } = session;
  const currentMember = session.membros.find((m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id);
  const isAdminOrOwner = currentMember?.perfil === 'PROPRIETARIO' || currentMember?.perfil === 'ADMINISTRADOR';

  const [showInformarModal, setShowInformarModal] = useState(false);
  const [showConfirmarModal, setShowConfirmarModal] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  if (!isOpen || !user || !activeGroup) return null;

  const isJ1 = partida.jogador_1_id === user.id;
  const isJ2 = partida.jogador_2_id === user.id;
  const isParticipant = isJ1 || isJ2;

  const j1Name = partida.jogador_1?.nome || 'Jogador 1';
  const j2Name = partida.jogador_2?.nome || 'Jogador 2';
  const j1Class = partida.jogador_1_classe || 'Sem Classe';
  const j2Class = partida.jogador_2_classe || 'Sem Classe';
  const winner = partida.vencedor?.nome || (partida.vencedor_id === partida.jogador_1_id ? j1Name : partida.vencedor_id === partida.jogador_2_id ? j2Name : null);

  const canReportScore =
    (isParticipant || isAdminOrOwner) &&
    ['CONFIRMADA', 'ACEITA', 'REALIZADA', 'AGUARDANDO_RESULTADO'].includes(partida.status);

  const canConfirmScore =
    (partida.status === 'AGUARDANDO_CONFIRMACAO_RESULTADO') &&
    ((isParticipant && partida.resultado_informado_por !== user.id) || isAdminOrOwner);

  const handleCancelMatch = async () => {
    if (isCanceling) return;
    setIsCanceling(true);
    try {
      await DbService.cancelMatch(partida.id, user.id);
      toast.success('Partida cancelada com sucesso.');
      onRefresh();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar partida.');
    } finally {
      setIsCanceling(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACEITA':
      case 'CONFIRMADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border border-blue-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Confirmada</span>
          </span>
        );
      case 'AGUARDANDO_RESULTADO':
      case 'REALIZADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
            <Hourglass className="w-3.5 h-3.5 text-amber-600" />
            <span>Aguardando Placar</span>
          </span>
        );
      case 'AGUARDANDO_CONFIRMACAO_RESULTADO':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-900 border border-purple-200">
            <Hourglass className="w-3.5 h-3.5 text-purple-600" />
            <span>Aguardando Confirmação</span>
          </span>
        );
      case 'FINALIZADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-200">
            <Trophy className="w-3.5 h-3.5 text-emerald-600" />
            <span>Finalizada</span>
          </span>
        );
      case 'CANCELADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
            <X className="w-3.5 h-3.5" />
            <span>Cancelada</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
          
          {/* HEADER */}
          <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🎾</span>
              <div>
                <h2 className="text-base font-black tracking-tight">Detalhes da Partida</h2>
                <p className="text-xs text-slate-400 font-medium">{activeGroup.nome}</p>
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

          {/* BODY */}
          <div className="p-6 overflow-y-auto space-y-6 flex-1">
            
            {/* STATUS BADGE */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-400">Status</span>
              {getStatusBadge(partida.status)}
            </div>

            {/* VS PLAYERS HERO CARD */}
            <div className="p-5 rounded-3xl bg-slate-50 border border-slate-200/80 shadow-2xs">
              <div className="flex items-center justify-between gap-4">
                
                {/* J1 */}
                <div className="flex-1 flex flex-col items-center text-center space-y-1.5">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl overflow-hidden border-2 border-slate-200 shadow-xs">
                      {partida.jogador_1?.foto_url ? (
                        <img
                          src={partida.jogador_1.foto_url}
                          alt={j1Name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{j1Name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {partida.vencedor_id === partida.jogador_1_id && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md text-xs">
                        🏆
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-black text-slate-900 line-clamp-1">{j1Name}</p>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {j1Class}
                  </span>
                </div>

                {/* VS BADGE */}
                <div className="shrink-0 flex flex-col items-center justify-center">
                  <div className="w-9 h-9 rounded-full bg-[#0F172A] text-[#ccff00] font-black text-xs flex items-center justify-center shadow-md">
                    VS
                  </div>
                </div>

                {/* J2 */}
                <div className="flex-1 flex flex-col items-center text-center space-y-1.5">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-xl overflow-hidden border-2 border-slate-200 shadow-xs">
                      {partida.jogador_2?.foto_url ? (
                        <img
                          src={partida.jogador_2.foto_url}
                          alt={j2Name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{j2Name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    {partida.vencedor_id === partida.jogador_2_id && (
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center shadow-md text-xs">
                        🏆
                      </div>
                    )}
                  </div>
                  <p className="text-xs font-black text-slate-900 line-clamp-1">{j2Name}</p>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                    {j2Class}
                  </span>
                </div>

              </div>
            </div>

            {/* PLACAR (SE HOUVER) */}
            {partida.detalhes_placar && (
              <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-2 text-center shadow-md">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#ccff00]">
                  Placar da Partida
                </span>
                
                {partida.sets && partida.sets.length > 0 ? (
                  <div className="flex items-center justify-center gap-2 pt-1">
                    {partida.sets.map((s, idx) => (
                      <div key={idx} className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 text-center">
                        <span className="text-[10px] text-slate-400 font-bold block">Set {s.numero_set}</span>
                        <span className="text-base font-black text-white">{s.jogador_1_games} × {s.jogador_2_games}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-lg font-black text-white">{partida.detalhes_placar}</p>
                )}

                {winner && (
                  <div className="pt-2 border-t border-slate-800 text-xs font-black text-amber-300 flex items-center justify-center gap-1.5">
                    <Trophy className="w-3.5 h-3.5" />
                    <span>Vencedor: {winner}</span>
                  </div>
                )}
              </div>
            )}

            {/* FOTO DA PARTIDA (SE HOUVER) */}
            {partida.foto_url && (
              <div className="space-y-2">
                <span className="text-xs font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  <span>Foto Oficial da Partida</span>
                </span>
                <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-950 aspect-video relative group">
                  <img
                    src={partida.foto_url}
                    alt="Foto da partida"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            )}

            {/* DETALHES DE RESERVA & LOCAL */}
            <div className="space-y-2 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
              <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block mb-2">
                Informações do Agendamento
              </span>
              
              {partida.reserva ? (
                <>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold flex items-center gap-1.5 text-slate-500">
                      <Calendar className="w-3.5 h-3.5" />
                      Data:
                    </span>
                    <span className="font-extrabold text-slate-900">{partida.reserva.data}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3.5 h-3.5" />
                      Horário:
                    </span>
                    <span className="font-extrabold text-slate-900">{partida.reserva.horario_label}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-bold flex items-center gap-1.5 text-slate-500">
                      <MapPin className="w-3.5 h-3.5" />
                      Local:
                    </span>
                    <span className="font-extrabold text-slate-900">
                      Quadra {partida.reserva.quadra_numero}
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-slate-500 font-medium">Partida direta do grupo.</p>
              )}
            </div>

            {/* AÇÕES CONTEXTUAIS */}
            <div className="space-y-2 pt-2">
              
              {/* Botão de Confirmar Resultado (Adversário) */}
              {canConfirmScore && (
                <button
                  type="button"
                  onClick={() => setShowConfirmarModal(true)}
                  className="w-full py-3.5 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>CONFERIR E CONFIRMAR PLACAR</span>
                </button>
              )}

              {/* Botão de Informar Resultado */}
              {canReportScore && (
                <button
                  type="button"
                  onClick={() => setShowInformarModal(true)}
                  className="w-full py-3.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>INFORMAR RESULTADO</span>
                </button>
              )}

              {/* Botão Cancelar Partida */}
              {(isParticipant || isAdminOrOwner) && partida.status !== 'FINALIZADA' && partida.status !== 'CANCELADA' && (
                <button
                  type="button"
                  onClick={handleCancelMatch}
                  disabled={isCanceling}
                  className="w-full py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-black transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4 text-rose-600" />
                  <span>Cancelar Partida</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>

          </div>

        </div>
      </div>

      {/* SUB-MODALS */}
      {showInformarModal && (
        <InformarResultadoModal
          partida={partida}
          session={session}
          isOpen={showInformarModal}
          onClose={() => setShowInformarModal(false)}
          onSuccess={() => {
            onRefresh();
            onClose();
          }}
        />
      )}

      {showConfirmarModal && (
        <ConfirmarResultadoModal
          partida={partida}
          session={session}
          isOpen={showConfirmarModal}
          onClose={() => setShowConfirmarModal(false)}
          onSuccess={() => {
            onRefresh();
            onClose();
          }}
        />
      )}
    </>
  );
};
