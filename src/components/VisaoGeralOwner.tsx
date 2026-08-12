import React, { useState, useEffect } from 'react';
import { AuthSession, MembroGrupo, Reserva, CourtConfig, PlayerClass } from '../types';
import { DbService } from '../lib/db';
import { formatLocation } from '../lib/location';
import {
  CalendarDays,
  UserPlus,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Users,
  Percent,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Activity,
  UserCheck,
  Sliders,
  Tag
} from 'lucide-react';

interface VisaoGeralOwnerProps {
  session: AuthSession;
  onNavigateTab: (tab: string) => void;
  onRefreshSession?: () => void;
}

export const VisaoGeralOwner: React.FC<VisaoGeralOwnerProps> = ({
  session,
  onNavigateTab,
  onRefreshSession,
}) => {
  const { user, activeGroup } = session;
  const ownerMember = session.membros.find((m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id);

  const [members, setMembers] = useState<MembroGrupo[]>([]);
  const [ownerClassState, setOwnerClassState] = useState<PlayerClass>(ownerMember?.classe || 'Sem Classe');

  useEffect(() => {
    if (ownerMember?.classe) {
      setOwnerClassState(ownerMember.classe);
    }
  }, [ownerMember?.classe]);
  const [todayBookings, setTodayBookings] = useState<Reserva[]>([]);
  const [courtConfig, setCourtConfig] = useState<CourtConfig | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!activeGroup) return;

    let isMounted = true;
    setLoading(true);

    Promise.all([
      DbService.getGroupMembers(activeGroup.id),
      DbService.getBookingsForDate(activeGroup.id, todayStr),
      DbService.getGroupCourtConfig(activeGroup.id, todayStr)
    ]).then(([mList, bList, config]) => {
      if (isMounted) {
        setMembers(mList);
        setTodayBookings(bList);
        setCourtConfig(config);
        setLoading(false);
      }
    }).catch(err => {
      console.error('Erro ao carregar dados da visão geral:', err);
      if (isMounted) setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [activeGroup?.id, todayStr]);

  if (!activeGroup || !user) return null;

  const handleCopyInvite = () => {
    if (activeGroup.codigo_convite) {
      navigator.clipboard.writeText(activeGroup.codigo_convite);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Calculations
  const activeMembersCount = members.filter(m => m.status === 'ATIVO').length;
  const pendingMembersList = members.filter(m => m.status === 'PENDENTE');
  const unclassedMembersList = members.filter(m => m.status === 'ATIVO' && (!m.classe || m.classe === 'Sem Classe'));

  const totalPossibleSlots = (courtConfig?.qtd_quadras || 4) * (courtConfig?.horarios?.length || 8);
  const todaysGamesCount = todayBookings.length;
  const freeSlotsCount = Math.max(0, totalPossibleSlots - todaysGamesCount);
  const occupancyRate = totalPossibleSlots > 0 ? Math.min(100, Math.round((todaysGamesCount / totalPossibleSlots) * 100)) : 0;

  // Pending Items Aggregation
  const pendingItems: Array<{
    id: string;
    titulo: string;
    descricao: string;
    acaoTexto: string;
    tabTarget: string;
  }> = [];

  if (pendingMembersList.length > 0) {
    pendingItems.push({
      id: 'pending_members',
      titulo: `${pendingMembersList.length} ${pendingMembersList.length === 1 ? 'novo jogador aguardando' : 'novos jogadores aguardando'} aprovação`,
      descricao: 'Analise o cadastro dos novos atletas para liberar o acesso ao grupo.',
      acaoTexto: 'Revisar cadastro',
      tabTarget: 'members'
    });
  }

  if (unclassedMembersList.length > 0) {
    pendingItems.push({
      id: 'unclassed_members',
      titulo: `${unclassedMembersList.length} ${unclassedMembersList.length === 1 ? 'jogador' : 'jogadores'} sem classe definida`,
      descricao: 'Atribua a classe (A, B, C ou D) aos atletas ativos do clube.',
      acaoTexto: 'Definir classe',
      tabTarget: 'members'
    });
  }

  if (!activeGroup.logo_url) {
    pendingItems.push({
      id: 'incomplete_group',
      titulo: 'Configuração incompleta do grupo',
      descricao: 'Adicione uma foto de perfil ou logo oficial ao seu grupo de tênis.',
      acaoTexto: 'Configurar grupo',
      tabTarget: 'admin_panel'
    });
  }

  const firstName = user.nome.split(' ')[0];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. COMPACT HEADER */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          
          {/* Group Logo & Info */}
          <div className="flex items-center gap-4">
            {activeGroup.logo_url ? (
              <img
                src={activeGroup.logo_url}
                alt={activeGroup.nome}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-2xs"
              />
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-[#0F172A] text-slate-200 flex items-center justify-center font-black text-2xl shrink-0 shadow-2xs">
                🎾
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {activeGroup.nome}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200 text-[10px] font-bold uppercase tracking-wider">
                  Grupo ativo
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  📍 {formatLocation(activeGroup.cidade, activeGroup.estado)}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-sm font-bold text-slate-800">
                  Olá, {firstName}
                </span>
                <span className="px-2 py-0.5 rounded-md bg-[#0F172A] text-slate-200 text-[10px] font-black uppercase tracking-wider border border-slate-800">
                  Proprietário
                </span>
                {ownerMember && (
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase">Classe:</span>
                    <select
                      value={ownerClassState}
                      onChange={async (e) => {
                        const newCls = e.target.value as PlayerClass;
                        setOwnerClassState(newCls);
                        try {
                          await DbService.updateMemberClass(ownerMember.id, newCls);
                          if (onRefreshSession) await onRefreshSession();
                        } catch (err: any) {
                          alert(err.message || 'Erro ao atualizar classe.');
                          setOwnerClassState(ownerMember?.classe || 'Sem Classe');
                        }
                      }}
                      className="bg-transparent text-[11px] font-black text-slate-900 focus:outline-none cursor-pointer"
                    >
                      <option value="Sem Classe">Sem Classe</option>
                      <option value="Classe A (1º)">Classe A (1º)</option>
                      <option value="Classe B (2º)">Classe B (2º)</option>
                      <option value="Classe C (3º)">Classe C (3º)</option>
                      <option value="Classe D (4º)">Classe D (4º)</option>
                      <option value="Classe E (5º)">Classe E (5º)</option>
                      <option value="Classe F (6º)">Classe F (6º)</option>
                      <option value="Classe G (7º)">Classe G (7º)</option>
                      <option value="Classe Infantil">Classe Infantil</option>
                      <option value="Classe Juvenil">Classe Juvenil</option>
                      <option value="Classe (50+)">Classe (50+)</option>
                    </select>
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Aqui está o resumo do seu grupo hoje.
              </p>
            </div>
          </div>

          {/* Header Right Actions & Compact Invite Code */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Compact Invite Code */}
            <div className="bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200 flex items-center gap-2 shrink-0">
              <div>
                <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 block">
                  Código do Grupo
                </span>
                <span className="text-xs font-mono font-bold text-slate-900 tracking-wider">
                  {activeGroup.codigo_convite || 'GRUPO9337'}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyInvite}
                title="Copiar Código de Convite"
                className="p-2 rounded-xl bg-white hover:bg-slate-200/80 text-slate-800 border border-slate-200 transition-all cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Primary Action 1: Ver agenda */}
            <button
              type="button"
              onClick={() => onNavigateTab('agenda')}
              className="px-4 py-2.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-slate-200 font-extrabold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <CalendarDays className="w-4 h-4 text-slate-300" />
              <span>Ver agenda</span>
            </button>

            {/* Primary Action 2: Convidar jogadores */}
            <button
              type="button"
              onClick={handleCopyInvite}
              className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-300 shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <UserPlus className="w-4 h-4 text-slate-700" />
              <span>{copied ? 'Código Copiado!' : 'Convidar jogadores'}</span>
            </button>

            {/* Primary Action 3: Configurar Classes */}
            <button
              type="button"
              onClick={() => onNavigateTab('admin_classes')}
              className="px-4 py-2.5 rounded-2xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-extrabold text-xs border border-purple-200 shadow-2xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <Tag className="w-4 h-4 text-purple-700" />
              <span>Configurar Classes</span>
            </button>
          </div>

        </div>
      </div>

      {/* 2. INDICADORES PRINCIPAIS (4 CARDS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Jogos de hoje */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Jogos de hoje
            </span>
            <CalendarDays className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {todaysGamesCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">partidas</span>
          </div>
        </div>

        {/* Card 2: Horários livres */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Horários livres
            </span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {freeSlotsCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">vagas</span>
          </div>
        </div>

        {/* Card 3: Jogadores ativos */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Jogadores ativos
            </span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {activeMembersCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">atletas</span>
          </div>
        </div>

        {/* Card 4: Taxa de ocupação */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Taxa de ocupação
            </span>
            <Percent className="w-4 h-4 text-slate-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {occupancyRate}%
            </span>
            <span className="text-xs text-slate-500 font-medium">de uso</span>
          </div>
        </div>

      </div>

      {/* 3. PENDÊNCIAS ADMINISTRATIVAS */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-slate-900" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Pendências administrativas
            </h3>
          </div>
          {pendingItems.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-extrabold text-[11px]">
              {pendingItems.length} pendente{pendingItems.length > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {pendingItems.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <p className="text-sm font-bold text-slate-800">
              Tudo certo por aqui! Não existem pendências administrativas.
            </p>
            <p className="text-xs text-slate-500 font-medium">
              Todos os jogadores estão aprovados com classe atribuída e o grupo está totalmente configurado.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-start justify-between gap-3"
              >
                <div className="space-y-1">
                  <h4 className="text-xs font-extrabold text-slate-900">
                    {item.titulo}
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    {item.descricao}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateTab(item.tabTarget)}
                  className="px-3 py-1.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] font-extrabold text-[11px] shadow-2xs shrink-0 cursor-pointer flex items-center gap-1 transition-all"
                >
                  <span>{item.acaoTexto}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. PRÓXIMOS JOGOS (MAX 5) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-slate-900" />
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
              Próximos jogos
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('agenda')}
            className="text-xs font-extrabold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Ver agenda completa</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {todayBookings.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <Clock className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="text-xs sm:text-sm font-bold text-slate-700">
              Nenhum jogo agendado para hoje ainda.
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab('agenda')}
              className="mt-2 px-4 py-2 rounded-xl bg-[#0F172A] text-[#ccff00] font-extrabold text-xs shadow-2xs cursor-pointer inline-flex items-center gap-1.5"
            >
              <span>Reservar Quadra</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayBookings.slice(0, 5).map((booking) => (
              <div
                key={booking.id}
                className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0F172A] text-[#ccff00] font-mono font-bold text-xs flex items-center justify-center shrink-0">
                    Q{booking.quadra_numero}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {booking.jogador_nome}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Horário: <strong className="text-slate-800">{booking.horario_label}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-800 font-extrabold text-[11px]">
                    {booking.jogador_classe || 'Sem Classe'}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-[11px] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Confirmado</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. ATIVIDADE RECENTE (MAX 5) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Activity className="w-5 h-5 text-slate-900" />
          <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
            Atividade recente
          </h3>
        </div>

        <div className="space-y-2 text-xs font-medium text-slate-700">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <UserCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <p className="truncate">
              <strong>Grupo ativo:</strong> {activeMembersCount} jogadores cadastrados no momento.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <CalendarDays className="w-4 h-4 text-slate-900 shrink-0" />
            <p className="truncate">
              <strong>Reservas de Hoje:</strong> {todaysGamesCount} jogos agendados nas quadras.
            </p>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-slate-700 shrink-0" />
            <p className="truncate">
              <strong>Configuração das Quadras:</strong> {courtConfig?.qtd_quadras || 4} quadras disponíveis para reserva.
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};
