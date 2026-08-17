import React, { useState, useEffect } from 'react';
import { AuthSession, MembroGrupo, PlayerClass, Quadra, TimeSlot, DEFAULT_PLAYER_CLASSES, Reserva } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import { getTodayCivilDate, isPastCivilDate, isPastTimeSlot, formatCivilDate } from '../lib/dateUtils';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Search,
  Calendar,
  Clock,
  MapPin,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
  Swords,
  Sparkles
} from 'lucide-react';

interface JogarFlowModalProps {
  session: AuthSession;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (matchId?: string) => void;
  preSelectedOpponentId?: string;
}

export const JogarFlowModal: React.FC<JogarFlowModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess,
  preSelectedOpponentId
}) => {
  const { user, activeGroup } = session;
  const currentMember = session.membros.find((m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id);
  const myClass: PlayerClass = currentMember?.classe || 'Sem Classe';

  // Step state: 1 = Classe, 2 = Adversário, 3 = Horário/Quadra, 4 = Confirmação
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Selections
  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);
  const [selectedOpponent, setSelectedOpponent] = useState<MembroGrupo | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayCivilDate());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [selectedCourt, setSelectedCourt] = useState<Quadra | null>(null);

  // Group data
  const [groupMembers, setGroupMembers] = useState<MembroGrupo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [courtConfig, setCourtConfig] = useState<any>(null);
  const [existingBookings, setExistingBookings] = useState<Reserva[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statsMap, setStatsMap] = useState<Record<string, { partidas: number; vitorias: number; aproveitamento: number }>>({});

  const todayStr = getTodayCivilDate();

  // Carregar dados dos membros do grupo e ranking
  useEffect(() => {
    if (!isOpen || !activeGroup) return;

    let isMounted = true;
    setLoadingData(true);

    Promise.all([
      DbService.getGroupMembers(activeGroup.id),
      DbService.getGroupRanking(activeGroup.id).catch(() => [])
    ])
      .then(([members, ranking]) => {
        if (!isMounted) return;
        setGroupMembers(members);

        const sMap: Record<string, { partidas: number; vitorias: number; aproveitamento: number }> = {};
        ranking.forEach((r) => {
          sMap[r.usuario.id] = {
            partidas: r.partidas,
            vitorias: r.vitorias,
            aproveitamento: r.aproveitamento
          };
        });
        setStatsMap(sMap);

        // Se houver adversário pré-selecionado (ex: clicou em "Desafiar" no ranking)
        if (preSelectedOpponentId) {
          const opp = members.find((m) => m.usuario_id === preSelectedOpponentId);
          if (opp) {
            setSelectedOpponent(opp);
            setSelectedClass(opp.classe);
            setStep(3);
          }
        }
      })
      .finally(() => {
        if (isMounted) setLoadingData(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeGroup?.id, preSelectedOpponentId]);

  // Carregar disponibilidade de quadras e horários da data selecionada
  useEffect(() => {
    if (!isOpen || !activeGroup || step < 3) return;

    let isMounted = true;
    DbService.getGroupCourtConfig(activeGroup.id, selectedDate)
      .then((cfg) => {
        if (isMounted) setCourtConfig(cfg);
      });

    DbService.getBookingsForDate(activeGroup.id, selectedDate)
      .then((bks) => {
        if (isMounted) setExistingBookings(bks);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, activeGroup?.id, selectedDate, step]);

  if (!isOpen || !user || !activeGroup) return null;

  // Filtrar classes que possuem jogadores disponíveis (exceto o próprio usuário)
  const availableMembers = groupMembers.filter(
    (m) => m.usuario_id !== user.id && m.status === 'ATIVO' && m.usuario
  );

  const membersByClass: Record<string, MembroGrupo[]> = {};
  availableMembers.forEach((m) => {
    const cls = m.classe || 'Sem Classe';
    if (!membersByClass[cls]) membersByClass[cls] = [];
    membersByClass[cls].push(m);
  });

  // Lista de adversários da classe selecionada
  const filteredOpponents = (selectedClass ? (membersByClass[selectedClass] || []) : availableMembers).filter(
    (m) =>
      m.usuario?.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.usuario?.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Verificar se horário/quadra está ocupado
  const isSlotCourtOccupied = (slotId: string, courtId?: string, courtNum?: number) => {
    return existingBookings.some((b) => {
      if (b.horario_id !== slotId) return false;
      if (courtId && b.quadra_id) return b.quadra_id === courtId;
      if (courtNum && b.quadra_numero) return b.quadra_numero === courtNum;
      return false;
    });
  };

  const handleSelectClass = (cls: PlayerClass) => {
    setSelectedClass(cls);
    setSearchQuery('');
    setStep(2);
  };

  const handleSelectOpponent = (opp: MembroGrupo) => {
    setSelectedOpponent(opp);
    setStep(3);
  };

  const handleSelectSlotAndCourt = (slot: TimeSlot, court: Quadra) => {
    setSelectedSlot(slot);
    setSelectedCourt(court);
    setStep(4);
  };

  const handleConfirmMatch = async () => {
    if (!selectedOpponent || !selectedSlot || !selectedCourt || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const opponentUserId = selectedOpponent.usuario_id || selectedOpponent.usuario?.id;
      if (!opponentUserId) {
        throw new Error('Não foi possível identificar o ID do adversário selecionado.');
      }

      console.log('[DEBUG Criar Desafio]', {
        jogador_1_id: user.id,
        jogador_2_id: opponentUserId,
        selectedOpponent_membro_id: selectedOpponent.id,
        selectedOpponent_usuario_id: selectedOpponent.usuario_id,
        selectedOpponent_obj_id: selectedOpponent.usuario?.id,
        status: 'PENDENTE',
        grupo_id: activeGroup.id
      });

      // 1. Criar a reserva real no sistema
      const booking = await DbService.createBooking({
        grupo_id: activeGroup.id,
        quadra_id: selectedCourt.id,
        quadra_numero: selectedCourt.numero,
        horario_id: selectedSlot.id,
        horario_label: selectedSlot.label,
        data: selectedDate,
        jogador_id: user.id,
        jogador_nome: user.nome,
        jogador_classe: myClass
      });

      // 2. Criar a partida vinculada com status PENDENTE
      const match = await DbService.createMatch({
        grupoId: activeGroup.id,
        reservaId: booking.id,
        jogador1Id: user.id,
        jogador2Id: opponentUserId,
        status: 'PENDENTE'
      });

      const oppName = selectedOpponent.usuario?.nome || 'seu adversário';
      toast.success(`Desafio enviado para ${oppName}! Horário reservado e aguardando aceite. 🎾`);
      onSuccess(match.id);
      onClose();
    } catch (err: any) {
      console.error('Erro ao agendar partida / criar desafio:', err);
      const isConstraintErr = err.message?.includes('violates check constraint') || err.message?.includes('partidas_status_check');
      const userMessage = isConstraintErr
        ? 'Não foi possível enviar o desafio. Tente novamente.'
        : (err.message || 'Não foi possível enviar o desafio. Tente novamente.');
      toast.error(userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCourts: Quadra[] = (courtConfig?.quadras || []).filter((q: Quadra) => q.ativa);
  const timeSlots: TimeSlot[] = courtConfig?.horarios || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* HEADER & STEP PROGRESS */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#ccff00] text-slate-950 flex items-center justify-center font-black text-sm">
                🎾
              </div>
              <div>
                <h2 className="text-base font-black tracking-tight flex items-center gap-1.5">
                  <span>Novo Jogo</span>
                  <span className="text-[11px] font-extrabold text-[#ccff00] px-2 py-0.5 rounded-full bg-slate-800">
                    Etapa {step} de 4
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium">
                  {step === 1 && 'Escolha a classe do adversário'}
                  {step === 2 && 'Escolha seu adversário'}
                  {step === 3 && 'Escolha quando e onde jogar'}
                  {step === 4 && 'Confirme os dados da partida'}
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

          {/* STEP INDICATOR BAR */}
          <div className="grid grid-cols-4 gap-1.5 mt-3">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s <= step ? 'bg-[#ccff00]' : 'bg-slate-800'
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP CONTENT */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* =================================================== */}
          {/* ETAPA 1: ESCOLHA A CLASSE DO ADVERSÁRIO */}
          {/* =================================================== */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400 tracking-wider">
                  Classes Disponíveis
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  Sua classe: <span className="text-slate-900 font-black">{myClass}</span>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {DEFAULT_PLAYER_CLASSES.map((cls) => {
                  const count = (membersByClass[cls] || []).length;
                  const isMyOwnClass = cls === myClass;

                  return (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => handleSelectClass(cls)}
                      disabled={count === 0}
                      className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between group cursor-pointer ${
                        count > 0
                          ? isMyOwnClass
                            ? 'bg-slate-900 border-slate-800 text-white shadow-md'
                            : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-900'
                          : 'bg-slate-50/50 border-slate-200/50 opacity-40 cursor-not-allowed'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-black text-sm ${isMyOwnClass ? 'text-white' : 'text-slate-900'}`}>
                            {cls}
                          </span>
                          {isMyOwnClass && (
                            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[#ccff00] text-slate-950">
                              Sua
                            </span>
                          )}
                        </div>
                        <p className={`text-[11px] font-semibold ${isMyOwnClass ? 'text-slate-300' : 'text-slate-500'}`}>
                          {count === 0
                            ? 'Nenhum jogador ativo'
                            : count === 1
                            ? '1 jogador disponível'
                            : `${count} jogadores disponíveis`}
                        </p>
                      </div>

                      {count > 0 && (
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-transform group-hover:translate-x-0.5 ${isMyOwnClass ? 'bg-slate-800 text-[#ccff00]' : 'bg-white text-slate-600 shadow-2xs'}`}>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Botão para ver todos os jogadores sem filtro de classe */}
              <button
                type="button"
                onClick={() => {
                  setSelectedClass(null);
                  setStep(2);
                }}
                className="w-full py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Users className="w-4 h-4" />
                <span>Ver Todos os Jogadores do Grupo</span>
              </button>
            </div>
          )}

          {/* =================================================== */}
          {/* ETAPA 2: ESCOLHA SEU ADVERSÁRIO */}
          {/* =================================================== */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1 text-xs font-black text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Voltar para Classes</span>
                </button>
                {selectedClass && (
                  <span className="text-xs font-extrabold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                    {selectedClass}
                  </span>
                )}
              </div>

              {/* BARRA DE PESQUISA */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar jogador pelo nome..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
                />
              </div>

              {/* LISTA DE ADVERSÁRIOS */}
              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {filteredOpponents.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 space-y-2">
                    <Users className="w-8 h-8 mx-auto opacity-50" />
                    <p className="text-xs font-bold">Nenhum jogador encontrado com esses critérios.</p>
                  </div>
                ) : (
                  filteredOpponents.map((opp) => {
                    const stats = statsMap[opp.usuario_id] || { partidas: 0, vitorias: 0, aproveitamento: 0 };
                    const oppName = opp.usuario?.nome || 'Jogador';
                    const oppClass = opp.classe || 'Sem Classe';

                    return (
                      <div
                        key={opp.id}
                        className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100/90 border border-slate-200/80 transition-all flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-xs">
                            {opp.usuario?.foto_url ? (
                              <img
                                src={opp.usuario.foto_url}
                                alt={oppName}
                                className="w-full h-full object-cover"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <span>{oppName.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-slate-900 truncate">{oppName}</h4>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">
                                {oppClass}
                              </span>
                              <span className="text-[10px] font-bold text-slate-500">
                                {stats.partidas} {stats.partidas === 1 ? 'jogo' : 'jogos'} · {stats.aproveitamento}% vitórias
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectOpponent(opp)}
                          className="px-3.5 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] font-black text-xs transition-all shrink-0 cursor-pointer shadow-xs flex items-center gap-1"
                        >
                          <span>Desafiar</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* =================================================== */}
          {/* ETAPA 3: ESCOLHA QUANDO E ONDE JOGAR */}
          {/* =================================================== */}
          {step === 3 && selectedOpponent && (
            <div className="space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="inline-flex items-center gap-1 text-xs font-black text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Trocar Adversário</span>
                </button>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <span>Adversário:</span>
                  <span className="font-black text-slate-900">{selectedOpponent.usuario?.nome}</span>
                </div>
              </div>

              {/* SELEÇÃO DE DATA */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                  <span>Selecione o Dia</span>
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    min={todayStr}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-extrabold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
                  />
                  {selectedDate === todayStr && (
                    <span className="text-xs font-black px-3 py-2.5 rounded-2xl bg-amber-100 text-amber-900 border border-amber-200">
                      Hoje
                    </span>
                  )}
                </div>
              </div>

              {/* DISPONIBILIDADE REAL DE HORÁRIOS & QUADRAS */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-600" />
                    <span>Horários & Quadras Disponíveis</span>
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400">
                    Toque para selecionar
                  </span>
                </label>

                {timeSlots.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    <p className="text-xs font-bold">Carregando horários da agenda...</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {timeSlots.map((slot) => {
                      const isPast = isPastTimeSlot(selectedDate, slot.inicio);

                      return (
                        <div
                          key={slot.id}
                          className={`p-3 rounded-2xl border transition-all ${
                            isPast
                              ? 'bg-slate-50/50 border-slate-200/50 opacity-40'
                              : 'bg-slate-50/80 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {slot.label}
                            </span>
                            {isPast && (
                              <span className="text-[10px] font-bold text-slate-400">Horário passado</span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {activeCourts.map((court) => {
                              const occupied = isSlotCourtOccupied(slot.id, court.id, court.numero);
                              const disabled = isPast || occupied;

                              return (
                                <button
                                  key={court.id}
                                  type="button"
                                  disabled={disabled}
                                  onClick={() => handleSelectSlotAndCourt(slot, court)}
                                  className={`py-2 px-2.5 rounded-xl text-xs font-black transition-all flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                                    disabled
                                      ? 'bg-slate-200/60 text-slate-400 cursor-not-allowed'
                                      : 'bg-white hover:bg-slate-900 hover:text-[#ccff00] text-slate-800 border border-slate-200 shadow-2xs hover:shadow-md'
                                  }`}
                                >
                                  <span>{court.nome}</span>
                                  <span className="text-[9px] font-semibold opacity-75">
                                    {occupied ? 'Ocupada' : isPast ? 'Encerrado' : 'Disponível'}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* =================================================== */}
          {/* ETAPA 4: CONFIRMAÇÃO DO JOGO (VS HERO SCREEN) */}
          {/* =================================================== */}
          {step === 4 && selectedOpponent && selectedSlot && selectedCourt && (
            <div className="space-y-5 animate-in fade-in">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-1 text-xs font-black text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Voltar e Alterar Horário</span>
              </button>

              {/* HERO VS CARD */}
              <div className="p-6 rounded-3xl bg-slate-900 text-white shadow-xl space-y-5 relative overflow-hidden">
                <div className="text-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#ccff00]">
                    Resumo do Duelo
                  </span>
                  <h3 className="text-base font-black tracking-tight mt-0.5">Partida de Tênis</h3>
                </div>

                <div className="flex items-center justify-between gap-4">
                  {/* J1 (Você) */}
                  <div className="flex-1 flex flex-col items-center text-center space-y-1.5">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-700 text-[#ccff00] flex items-center justify-center font-black text-xl overflow-hidden shadow-md">
                      {user.foto_url ? (
                        <img
                          src={user.foto_url}
                          alt={user.nome}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{user.nome.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-xs font-black line-clamp-1">{user.nome}</span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {myClass}
                    </span>
                  </div>

                  {/* VS ICON */}
                  <div className="shrink-0 flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-[#ccff00] text-slate-950 font-black text-xs flex items-center justify-center shadow-lg">
                      VS
                    </div>
                  </div>

                  {/* J2 (Adversário) */}
                  <div className="flex-1 flex flex-col items-center text-center space-y-1.5">
                    <div className="w-16 h-16 rounded-2xl bg-slate-800 border-2 border-slate-700 text-white flex items-center justify-center font-black text-xl overflow-hidden shadow-md">
                      {selectedOpponent.usuario?.foto_url ? (
                        <img
                          src={selectedOpponent.usuario.foto_url}
                          alt={selectedOpponent.usuario.nome}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{selectedOpponent.usuario?.nome.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span className="text-xs font-black line-clamp-1">
                      {selectedOpponent.usuario?.nome}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {selectedOpponent.classe || 'Sem Classe'}
                    </span>
                  </div>
                </div>

                {/* DETALHES DE HORÁRIO / LOCAL */}
                <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 text-xs space-y-2">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 font-bold text-slate-400">
                      <Calendar className="w-3.5 h-3.5 text-[#ccff00]" />
                      Data:
                    </span>
                    <span className="font-black text-white">{selectedDate}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 font-bold text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-[#ccff00]" />
                      Horário:
                    </span>
                    <span className="font-black text-white">{selectedSlot.label}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="flex items-center gap-1.5 font-bold text-slate-400">
                      <MapPin className="w-3.5 h-3.5 text-[#ccff00]" />
                      Local:
                    </span>
                    <span className="font-black text-white">{selectedCourt.nome}</span>
                  </div>
                </div>
              </div>

              {/* BOTÃO CONFIRMAR */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleConfirmMatch}
                  disabled={isSubmitting}
                  className="w-full py-4 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black tracking-wide shadow-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Agendando Partida...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>CONFIRMAR PARTIDA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
