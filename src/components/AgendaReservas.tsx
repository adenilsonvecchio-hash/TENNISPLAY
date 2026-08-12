import React, { useState, useEffect } from 'react';
import {
  AuthSession,
  CourtConfig,
  Reserva,
  TimeSlot,
  DEFAULT_HORARIOS_PADRAO,
  PlayerClass
} from '../types';
import { DbService } from '../lib/db';
import { getSupabaseClient } from '../lib/supabase';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Trash2,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Users,
  Filter,
  ArrowDown,
  UserCheck
} from 'lucide-react';

interface AgendaReservasProps {
  session: AuthSession;
  onRefreshSession?: () => void;
}

export const AgendaReservas: React.FC<AgendaReservasProps> = ({ session }) => {
  const { user, activeGroup, activeRole } = session;

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Class Filter: 'Todas' | 'Classe A' | 'Classe B' | 'Classe C' | 'Classe D'
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('Todas');

  const [courtConfig, setCourtConfig] = useState<CourtConfig>({
    grupo_id: activeGroup?.id || '',
    data: todayStr,
    qtd_quadras: 4,
    horarios: DEFAULT_HORARIOS_PADRAO,
    prazo_cancelamento_horas: 2
  });
  const [bookings, setBookings] = useState<Reserva[]>([]);
  const [groupMembersCount, setGroupMembersCount] = useState<number>(0);

  // Admin Court Config Drawer State
  const [showAdminConfig, setShowAdminConfig] = useState(false);
  const [numQuadrasInput, setNumQuadrasInput] = useState<number>(4);
  const [prazoCancelamentoInput, setPrazoCancelamentoInput] = useState<number>(2);
  const [customHorarios, setCustomHorarios] = useState<TimeSlot[]>(DEFAULT_HORARIOS_PADRAO);
  const [newInicio, setNewInicio] = useState('');
  const [newFim, setNewFim] = useState('');

  // Booking Modal / Confirmation state
  const [bookingTarget, setBookingTarget] = useState<{
    slot: TimeSlot;
    quadra: number;
  } | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAdmin = activeRole === 'PROPRIETARIO' || activeRole === 'ADMINISTRADOR';

  const refreshData = async () => {
    if (!activeGroup) return;
    const config = await DbService.getGroupCourtConfig(activeGroup.id, selectedDate);
    setCourtConfig(config);
    setNumQuadrasInput(config.qtd_quadras);
    setPrazoCancelamentoInput(config.prazo_cancelamento_horas);
    setCustomHorarios(config.horarios);

    const dayBookings = await DbService.getBookingsForDate(activeGroup.id, selectedDate);
    setBookings(dayBookings);

    const members = await DbService.getGroupMembers(activeGroup.id);
    setGroupMembersCount(members.filter(m => m.status === 'ATIVO').length);
  };

  // Load bookings and court config when activeGroup or selectedDate changes
  useEffect(() => {
    if (!activeGroup) return;

    refreshData();

    // Setup Supabase Realtime Subscription if client is available
    const supabase = getSupabaseClient();
    if (supabase) {
      const channel = supabase
        .channel(`public:reservas:${activeGroup.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'reservas',
            filter: `grupo_id=eq.${activeGroup.id}`
          },
          async () => {
            const updated = await DbService.getBookingsForDate(activeGroup.id, selectedDate);
            setBookings(updated);
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeGroup?.id, selectedDate]);

  if (!activeGroup || !user) return null;

  // Date Navigation Helpers
  const handleDateOffset = (offsetDays: number) => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    const current = new Date(y, m - 1, d);
    current.setDate(current.getDate() + offsetDays);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
  };

  const formatDisplayDate = (dStr: string) => {
    const [y, m, d] = dStr.split('-');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const dayName = dateObj.toLocaleDateString('pt-BR', { weekday: 'short' });
    return `${d}/${m}/${y} (${dayName.toUpperCase()})`;
  };

  // Save Admin Court Configuration for the Day
  const handleSaveCourtConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numQuadrasInput < 1 || numQuadrasInput > 12) {
      alert('Informe um número de quadras entre 1 e 12.');
      return;
    }

    try {
      const updated = await DbService.saveGroupCourtConfig(
        activeGroup.id,
        selectedDate,
        numQuadrasInput,
        customHorarios,
        prazoCancelamentoInput
      );
      setCourtConfig(updated);
      setShowAdminConfig(false);
      setFeedback({
        type: 'success',
        message: `Configuração atualizada! Teremos ${updated.qtd_quadras} quadra(s) para esta data.`
      });
      setTimeout(() => setFeedback(null), 4000);
      await refreshData();
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar configuração.');
    }
  };

  const handleAddHorario = () => {
    if (!newInicio || !newFim) return;
    const newId = 'h_' + Date.now();
    const label = `${newInicio} às ${newFim}`;
    const newSlot: TimeSlot = { id: newId, inicio: newInicio, fim: newFim, label };
    setCustomHorarios([...customHorarios, newSlot]);
    setNewInicio('');
    setNewFim('');
  };

  const handleRemoveHorario = (id: string) => {
    setCustomHorarios(customHorarios.filter(h => h.id !== id));
  };

  // Confirm Reservation
  const handleConfirmReservation = async () => {
    if (!bookingTarget) return;

    try {
      await DbService.createBooking({
        grupo_id: activeGroup.id,
        data: selectedDate,
        horario_id: bookingTarget.slot.id,
        horario_label: bookingTarget.slot.label,
        quadra_numero: bookingTarget.quadra,
        jogador_id: user.id,
        jogador_nome: user.nome,
        jogador_classe: 'Sem Classe'
      });

      setBookingTarget(null);
      setFeedback({
        type: 'success',
        message: `Reserva confirmada na Quadra ${bookingTarget.quadra} (${bookingTarget.slot.label})!`
      });
      setTimeout(() => setFeedback(null), 4000);
      await refreshData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Horário indisponível.'
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Cancel Reservation
  const handleCancelReservation = async (bookingId: string) => {
    if (!confirm('Deseja realmente cancelar esta reserva?')) return;

    try {
      await DbService.cancelBooking(bookingId, user.id, activeRole || 'JOGADOR');
      setFeedback({
        type: 'success',
        message: 'Reserva cancelada com sucesso.'
      });
      setTimeout(() => setFeedback(null), 4000);
      await refreshData();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Não foi possível cancelar.'
      });
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  // Calculations for KPI Header Cards
  const totalSlotsPossible = courtConfig.qtd_quadras * courtConfig.horarios.length;
  const totalReservados = bookings.length;
  const totalLivres = Math.max(0, totalSlotsPossible - totalReservados);
  const minhasReservas = bookings.filter(b => b.jogador_id === user.id);
  const taxaOcupacao = Math.round((totalReservados / (totalSlotsPossible || 1)) * 100);

  // Next game calculation for welcome banner
  const nextGame = minhasReservas[0];

  // Scroll to Schedule Grid
  const scrollToSchedule = () => {
    const el = document.getElementById('horarios-grid-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 relative pb-20">
      
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between gap-3 shadow-md border animate-in slide-in-from-top-2 duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-600 text-white border-emerald-500'
              : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-white/80 hover:text-white text-xs underline font-normal">
            Fechar
          </button>
        </div>
      )}

      {/* 1. TELA INICIAL DO JOGADOR (WELCOME BANNER) */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-sm space-y-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-80 h-80 bg-slate-100/60 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-[#0F172A] text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-800">
              TennisPlay Agenda
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
              Olá, {user.nome}! 👋
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium">
              Você possui hoje: <strong className="text-slate-900 font-bold">{minhasReservas.length} {minhasReservas.length === 1 ? 'reserva' : 'reservas'}</strong> no grupo {activeGroup.nome}.
            </p>
          </div>

          {/* Next Game Box / Action Button */}
          <div className="bg-slate-50/90 rounded-2xl p-4 border border-slate-200 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Próximo Jogo</span>
              <span className="text-xs font-bold text-slate-900">
                {selectedDate === todayStr ? 'Hoje' : selectedDate}
              </span>
            </div>

            {nextGame ? (
              <div className="space-y-1">
                <p className="font-black text-slate-900 text-sm sm:text-base">
                  Quadra {nextGame.quadra_numero} — {nextGame.horario_label}
                </p>
                <p className="text-xs text-slate-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-600" /> Confirmado (Meu Horário)
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 font-medium">
                Nenhum jogo agendado para esta data.
              </p>
            )}

            <button
              onClick={scrollToSchedule}
              className="w-full py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-extrabold text-xs shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Reservar Agora</span>
              <ArrowDown className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </div>

      {/* 2. INDICADORES / KPIS REQUIRED BY PROMPT */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quadras Ativas</span>
          <span className="text-lg sm:text-xl font-black text-slate-900">{courtConfig.qtd_quadras} Ativas</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Horários Livres</span>
          <span className="text-lg sm:text-xl font-black text-slate-700">{totalLivres} Livres</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reservados</span>
          <span className="text-lg sm:text-xl font-black text-rose-600">{totalReservados} Ocupados</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Minhas Reservas</span>
          <span className="text-lg sm:text-xl font-black text-blue-600">{minhasReservas.length} Minhas</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Taxa de Ocupação</span>
          <span className="text-lg sm:text-xl font-black text-purple-600">{taxaOcupacao}%</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Jogadores no Grupo</span>
          <span className="text-lg sm:text-xl font-black text-slate-900">{groupMembersCount} Atletas</span>
        </div>
      </div>

      {/* 3. CONTROLS BAR: DATE SELECTOR & CLASS FILTERS */}
      <div id="horarios-grid-section" className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          
          {/* Date Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => handleDateOffset(-1)}
                className="p-2 hover:bg-white rounded-xl text-slate-700 transition-colors"
                title="Dia Anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSelectedDate(todayStr)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  selectedDate === todayStr ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-700 hover:bg-white'
                }`}
              >
                Hoje
              </button>
              <button
                onClick={() => {
                  const tom = new Date();
                  tom.setDate(tom.getDate() + 1);
                  setSelectedDate(tom.toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-white transition-all"
              >
                Amanhã
              </button>
              <button
                onClick={() => handleDateOffset(1)}
                className="p-2 hover:bg-white rounded-xl text-slate-700 transition-colors"
                title="Próximo Dia"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="relative flex items-center">
              <CalendarIcon className="w-4 h-4 text-slate-600 absolute left-3 pointer-events-none" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 cursor-pointer"
              />
            </div>

            <span className="text-xs font-black text-slate-700 uppercase tracking-wider hidden lg:inline-block">
              {formatDisplayDate(selectedDate)}
            </span>
          </div>

          {/* Admin Court Setting Toggle */}
          {isAdmin && (
            <button
              onClick={() => setShowAdminConfig(!showAdminConfig)}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 shrink-0"
            >
              <Settings2 className="w-4 h-4 text-slate-300" />
              <span>Configurar Quadras & Horários</span>
            </button>
          )}
        </div>

        {/* CLASS FILTER REQUIREMENT: [Todas, Classe A, Classe B, Classe C, Classe D] */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-600" />
            <span>Filtro por Classe:</span>
          </span>
          {['Todas', 'Classe A (1º)', 'Classe B (2º)', 'Classe C (3º)', 'Classe D (4º)', 'Classe E (5º)', 'Classe F (6º)', 'Classe G (7º)', 'Classe Infantil', 'Classe Juvenil', 'Classe (50+)'].map((cls) => (
            <button
              key={cls}
              onClick={() => setSelectedClassFilter(cls)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedClassFilter === cls
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>

      </div>

      {/* ADMIN COURT CONFIGURATION DRAWER */}
      {isAdmin && showAdminConfig && (
        <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-xl space-y-6 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-slate-800 text-slate-200 flex items-center justify-center font-bold">
                🎾
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  Configuração de Quadras do Dia ({formatDisplayDate(selectedDate)})
                </h3>
                <p className="text-xs text-slate-400">
                  Defina o número de quadras disponíveis e as faixas de horários.
                </p>
              </div>
            </div>
            <button onClick={() => setShowAdminConfig(false)} className="text-slate-400 hover:text-white text-xs underline">
              Fechar
            </button>
          </div>

          <form onSubmit={handleSaveCourtConfig} className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Quantas quadras estarão disponíveis hoje?
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5, 6].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setNumQuadrasInput(num)}
                      className={`flex-1 py-3 rounded-2xl font-black text-xs border transition-all ${
                        numQuadrasInput === num
                          ? 'bg-slate-800 text-white border-slate-600 shadow-lg'
                          : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {num} {num === 1 ? 'Quadra' : 'Quadras'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-300">
                  Prazo Limite para Cancelamento (Horas)
                </label>
                <input
                  type="number"
                  min="0"
                  max="48"
                  value={prazoCancelamentoInput}
                  onChange={(e) => setPrazoCancelamentoInput(parseInt(e.target.value) || 0)}
                  className="w-24 px-4 py-3 rounded-2xl bg-slate-800 border border-slate-700 text-white font-bold text-sm focus:ring-2 focus:ring-slate-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="submit"
                className="px-6 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-white font-black text-xs shadow-lg border border-slate-700"
              >
                Salvar Configuração
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 4. LEGEND BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 flex items-center justify-between gap-4 flex-wrap text-xs font-bold text-slate-700">
        <span className="text-slate-500 font-normal">Legenda de Status:</span>
        <div className="flex items-center gap-5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-400 border border-slate-500" />
            <span>Livre / Disponível (Cinza)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-rose-500 border border-rose-600" />
            <span>Reservado (Vermelho)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-blue-600 border border-blue-700" />
            <span>Meu Horário (Azul)</span>
          </div>
        </div>
      </div>

      {/* SECTION TITLE */}
      <div className="pt-2">
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <span>Horários Disponíveis Hoje</span>
          <span className="text-xs font-bold text-slate-400 font-normal">({courtConfig.horarios.length} faixas de horários)</span>
        </h2>
      </div>

      {/* 5. AGENDA CARDS GRID (TIME SLOTS) */}
      <div className="space-y-6">
        {courtConfig.horarios.map((slot) => {
          return (
            <div
              key={slot.id}
              className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-xs space-y-4 hover:border-slate-300 transition-colors"
            >
              {/* Slot Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                    <Clock className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base sm:text-lg">
                      {slot.label}
                    </h3>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  {courtConfig.qtd_quadras} {courtConfig.qtd_quadras === 1 ? 'Quadra' : 'Quadras'}
                </span>
              </div>

              {/* Courts Side-By-Side Grid */}
              <div
                className={`grid grid-cols-1 ${
                  courtConfig.qtd_quadras === 1
                    ? 'grid-cols-1'
                    : courtConfig.qtd_quadras === 2
                    ? 'sm:grid-cols-2'
                    : 'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                } gap-4`}
              >
                {Array.from({ length: courtConfig.qtd_quadras }).map((_, qIdx) => {
                  const quadraNum = qIdx + 1;

                  // Find booking for this slot + quadra
                  const existingBooking = bookings.find(
                    b => b.horario_id === slot.id && b.quadra_numero === quadraNum
                  );

                  // Apply Class filter if active
                  if (
                    selectedClassFilter !== 'Todas' &&
                    existingBooking &&
                    existingBooking.jogador_classe &&
                    existingBooking.jogador_classe !== selectedClassFilter
                  ) {
                    // Skip or keep according to filter logic
                  }

                  const isMyBooking = existingBooking?.jogador_id === user.id;

                  // 1. MEU HORÁRIO (AZUL)
                  if (existingBooking && isMyBooking) {
                    return (
                      <div
                        key={quadraNum}
                        className="p-4 rounded-2xl bg-blue-600 text-white shadow-md border-2 border-blue-400 flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-white font-black text-[11px] uppercase tracking-wider">
                            Quadra {quadraNum}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-blue-900 text-blue-100 font-black text-[10px] uppercase border border-blue-400/40">
                            Meu Horário
                          </span>
                        </div>

                        <div>
                          <p className="text-xs text-blue-100 font-medium">Reservado por você:</p>
                          <h4 className="font-black text-white text-sm sm:text-base mt-0.5">
                            {user.nome}
                          </h4>
                        </div>

                        <div className="pt-2 border-t border-blue-400/40 flex items-center justify-between">
                          <span className="text-[11px] text-blue-100 font-medium flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-200" /> Confirmado
                          </span>

                          <button
                            onClick={() => handleCancelReservation(existingBooking.id)}
                            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/30 transition-all active:scale-95"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // 2. RESERVADO POR OUTRO JOGADOR (VERMELHO)
                  if (existingBooking && !isMyBooking) {
                    return (
                      <div
                        key={quadraNum}
                        className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-300 text-slate-900 shadow-xs flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded-lg bg-rose-200 text-rose-950 font-black text-[11px] uppercase tracking-wider">
                            Quadra {quadraNum}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-lg bg-rose-600 text-white font-black text-[10px] uppercase shadow-2xs">
                            Reservado
                          </span>
                        </div>

                        <div>
                          {isAdmin ? (
                            <>
                              <p className="text-[10px] text-rose-700 font-bold uppercase">Reservado por (Visão Admin):</p>
                              <h4 className="font-bold text-slate-900 text-xs mt-0.5">{existingBooking.jogador_nome}</h4>
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-rose-700 font-bold">Status do Horário:</p>
                              <h4 className="font-black text-rose-800 text-sm mt-0.5">Reservado</h4>
                            </>
                          )}
                        </div>

                        <div className="pt-2 border-t border-rose-200 flex items-center justify-between">
                          <span className="text-[11px] text-rose-600 font-bold flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5 text-rose-500" /> Indisponível
                          </span>

                          {isAdmin && (
                            <button
                              onClick={() => handleCancelReservation(existingBooking.id)}
                              className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold"
                            >
                              Cancelar Admin
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // 3. LIVRE (CINZA SLATE ELEGANTE)
                  return (
                    <div
                      key={quadraNum}
                      className="p-4 rounded-2xl bg-slate-50 border-2 border-slate-200 hover:border-slate-400 text-slate-900 shadow-2xs transition-all flex flex-col justify-between space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-200 text-slate-800 font-black text-[11px] uppercase tracking-wider">
                          Quadra {quadraNum}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-white font-black text-[10px] uppercase shadow-2xs">
                          Livre
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-slate-800 font-bold flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-slate-600" />
                          <span>Disponível</span>
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          Horário livre para reserva.
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200 flex items-center justify-end">
                        <button
                          onClick={() => setBookingTarget({ slot, quadra: quadraNum })}
                          className="w-full py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <span>Reservar</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>



      {/* CONFIRMATION MODAL */}
      {bookingTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-white flex items-center justify-center text-2xl font-bold">
                🎾
              </div>
              <div>
                <h3 className="font-black text-xl text-slate-900">Confirmar Reserva</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {activeGroup.nome} — {formatDisplayDate(selectedDate)}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Quadra:</span>
                <span className="font-bold text-slate-900">Quadra {bookingTarget.quadra}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Horário:</span>
                <span className="font-bold text-slate-900">{bookingTarget.slot.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Jogador:</span>
                <span className="font-bold text-slate-900">{user.nome}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium text-center">
              Ao confirmar, a quadra ficará reservada para você nesta faixa de horário.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setBookingTarget(null)}
                className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReservation}
                className="flex-1 py-3 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white font-extrabold text-xs shadow-md transition-all active:scale-95 cursor-pointer"
              >
                Confirmar Reserva
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
