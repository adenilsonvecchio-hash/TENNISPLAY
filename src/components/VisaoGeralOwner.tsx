import React, { useState, useEffect } from 'react';
import { AuthSession, MembroGrupo, Reserva, PlayerClass } from '../types';
import { DbService } from '../lib/db';
import { toast, formatClassUpdateToastMessage } from '../lib/toast';
import {
  CalendarDays,
  CalendarCheck,
  Users,
  User,
  Sliders,
  ChevronRight,
  Clock,
  Copy,
  Check,
  ArrowRight,
  Shield
} from 'lucide-react';

interface VisaoGeralOwnerProps {
  session: AuthSession;
  onNavigateTab: (tab: string) => void;
  onRefreshSession?: () => void;
  onOpenManualPdf?: () => void;
}

export const VisaoGeralOwner: React.FC<VisaoGeralOwnerProps> = ({
  session,
  onNavigateTab,
  onRefreshSession,
}) => {
  const { user, activeGroup } = session;
  const currentMember = session.membros.find(
    (m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id
  );
  const userRole = currentMember?.perfil || session.activeRole || 'JOGADOR';
  const isOwnerOrAdmin =
    (userRole === 'PROPRIETARIO' || userRole === 'ADMINISTRADOR') &&
    currentMember?.status === 'ATIVO';

  const roleLabel =
    userRole === 'PROPRIETARIO'
      ? 'Proprietário'
      : userRole === 'ADMINISTRADOR'
      ? 'Administrador'
      : 'Jogador';

  const [ownerClassState, setOwnerClassState] = useState<PlayerClass>(
    currentMember?.classe || 'Sem Classe'
  );
  const [nextUserBooking, setNextUserBooking] = useState<Reserva | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (currentMember?.classe) {
      setOwnerClassState(currentMember.classe);
    }
  }, [currentMember?.classe]);

  useEffect(() => {
    if (!activeGroup || !user) return;

    let isMounted = true;
    setLoading(true);

    DbService.getUserBookingsAll(user.id, activeGroup.id)
      .then((userBookings) => {
        if (isMounted) {
          // Filtrar reservas futuras ou de hoje
          const upcoming = userBookings
            .filter((b) => b.data >= todayStr)
            .sort(
              (a, b) =>
                a.data.localeCompare(b.data) ||
                a.horario_label.localeCompare(b.horario_label)
            );

          setNextUserBooking(upcoming.length > 0 ? upcoming[0] : null);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Erro ao carregar reservas do usuário:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeGroup?.id, user?.id, todayStr]);

  if (!activeGroup || !user) return null;

  const handleCopyInvite = () => {
    if (activeGroup.codigo_convite) {
      navigator.clipboard.writeText(activeGroup.codigo_convite);
      setCopied(true);
      toast.success('Código do grupo copiado!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const firstName = user.nome ? user.nome.split(' ')[0] : 'Jogador';

  const formatBookingDate = (dateStr: string) => {
    if (dateStr === todayStr) return 'Hoje';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-4 sm:space-y-5 animate-in fade-in duration-200">
      
      {/* 1. SAUDAÇÃO E INFORMAÇÃO DO GRUPO (BLOCO COMPACTO) */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Olá, {firstName} 👋
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500">
              Pronto para o próximo jogo?
            </p>
          </div>

          {/* Código de convite discreto para Admin/Owner */}
          {isOwnerOrAdmin && activeGroup.codigo_convite && (
            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                type="button"
                onClick={handleCopyInvite}
                title="Copiar código do grupo"
                className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Código: <strong className="font-mono text-slate-900">{activeGroup.codigo_convite}</strong></span>
              </button>
            </div>
          )}

        </div>

        {/* Linha única com Informações do Grupo, Classe e Papel */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          
          {/* Nome do grupo */}
          <span className="font-extrabold text-slate-900 tracking-tight">
            {activeGroup.nome}
          </span>

          <span className="text-slate-300">•</span>

            {/* Classe do jogador (informação somente leitura) */}
            <div className="flex items-center gap-1 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                Classe:
              </span>
              <span className="text-[11px] font-black text-slate-900">
                {currentMember?.classe || 'Sem Classe'}
              </span>
            </div>

          <span className="text-slate-300">•</span>

          {/* Selo do perfil */}
          <span
            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
              userRole === 'PROPRIETARIO'
                ? 'bg-[#0F172A] text-[#ccff00] border-slate-800'
                : userRole === 'ADMINISTRADOR'
                ? 'bg-indigo-950 text-white border-indigo-900'
                : 'bg-slate-100 text-slate-800 border-slate-200'
            }`}
          >
            {roleLabel}
          </span>

        </div>
      </div>

      {/* 2. AÇÃO PRINCIPAL ÚNICA: BOTÃO AGENDAR HORÁRIO */}
      <div>
        <button
          type="button"
          onClick={() => onNavigateTab('agenda')}
          className="w-full min-h-[50px] sm:min-h-[54px] py-3.5 px-6 rounded-2xl bg-[#0F172A] hover:bg-slate-800 active:scale-[0.99] text-[#ccff00] font-black text-sm sm:text-base shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer"
        >
          <CalendarDays className="w-5 h-5 text-[#ccff00] shrink-0" />
          <span>Agendar horário</span>
        </button>
      </div>

      {/* 3. CARTÃO PRÓXIMO JOGO */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-slate-900 shrink-0" />
            <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
              Próximo jogo
            </h2>
          </div>
          {nextUserBooking && (
            <button
              type="button"
              onClick={() => onNavigateTab('historico')}
              className="text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
            >
              Minhas reservas
            </button>
          )}
        </div>

        {nextUserBooking ? (
          <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#0F172A] text-[#ccff00] font-black text-xs sm:text-sm flex items-center justify-center shrink-0">
                Q{nextUserBooking.quadra_numero}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-slate-900">
                    Quadra {nextUserBooking.quadra_numero}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase">
                    Confirmada
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  📅 {formatBookingDate(nextUserBooking.data)} • ⏰ {nextUserBooking.horario_label}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('historico')}
              className="self-end sm:self-center px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-300 shadow-2xs transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <span>Ver detalhes</span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        ) : (
          <div className="py-3 px-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs sm:text-sm font-bold text-slate-800">
                  Você ainda não possui uma reserva.
                </p>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Escolha um horário disponível para seu próximo jogo.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigateTab('agenda')}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 underline hover:no-underline cursor-pointer self-start sm:self-center pl-12 sm:pl-0 pt-1 sm:pt-0"
            >
              Consultar agenda
            </button>
          </div>
        )}
      </div>

      {/* 4. ACESSOS RÁPIDOS DO JOGADOR (GRADE DE 4 OPÇÕES) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
        
        {/* 1. Agenda */}
        <button
          type="button"
          onClick={() => onNavigateTab('agenda')}
          className="bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xs transition-all cursor-pointer min-h-[96px] sm:min-h-[110px] group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-[#ccff00] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-2xs">
            <CalendarDays className="w-5 h-5" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
            Agenda
          </span>
        </button>

        {/* 2. Minhas Reservas */}
        <button
          type="button"
          onClick={() => onNavigateTab('historico')}
          className="bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xs transition-all cursor-pointer min-h-[96px] sm:min-h-[110px] group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-[#ccff00] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-2xs">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
            Minhas reservas
          </span>
        </button>

        {/* 3. Jogadores */}
        <button
          type="button"
          onClick={() => onNavigateTab('members')}
          className="bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xs transition-all cursor-pointer min-h-[96px] sm:min-h-[110px] group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-[#ccff00] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-2xs">
            <Users className="w-5 h-5" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
            Jogadores
          </span>
        </button>

        {/* 4. Meu Perfil */}
        <button
          type="button"
          onClick={() => onNavigateTab('profile')}
          className="bg-white hover:bg-slate-50 active:scale-[0.98] border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col items-center justify-center text-center shadow-2xs transition-all cursor-pointer min-h-[96px] sm:min-h-[110px] group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-[#ccff00] flex items-center justify-center mb-2 group-hover:scale-105 transition-transform shadow-2xs">
            <User className="w-5 h-5" />
          </div>
          <span className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
            Meu perfil
          </span>
        </button>

      </div>

      {/* 5. ÁREA ADMINISTRATIVA SEPARADA (APENAS ADMINISTRADOR OU PROPRIETÁRIO) */}
      {isOwnerOrAdmin && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center shrink-0 border border-slate-200">
              <Sliders className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-slate-900">
                Gestão do grupo
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                Administrar quadras, jogadores, classes e configurações.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('admin_panel')}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 active:scale-[0.98] text-[#ccff00] font-extrabold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
          >
            <span>Acessar gestão</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#ccff00]" />
          </button>
        </div>
      )}

    </div>
  );
};
