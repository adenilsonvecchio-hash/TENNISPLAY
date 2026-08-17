import React, { useState, useEffect } from 'react';
import { AuthSession, MembroGrupo, PlayerClass, DEFAULT_PLAYER_CLASSES, MemberStatus, Grupo, Usuario, Reserva, CourtConfig, podeAlterarClasse } from '../types';
import { DbService } from '../lib/db';
import { toast, formatClassUpdateToastMessage } from '../lib/toast';
import { formatLocation } from '../lib/location';
import { GroupAvatar } from './GroupAvatar';
import { GroupImageModal } from './GroupImageModal';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  UserX,
  Clock,
  Calendar,
  Settings,
  BarChart3,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Plus,
  Trash2,
  Sliders,
  Sparkles,
  Building2,
  Search,
  Check,
  Tag,
  AlertCircle,
  X
} from 'lucide-react';

interface AdminPanelProps {
  session: AuthSession;
  onRefreshSession: () => void;
  initialTab?: 'dashboard' | 'membros' | 'solicitacoes' | 'reservas' | 'classes' | 'relatorios' | 'config';
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ session, onRefreshSession, initialTab }) => {
  const { user, activeGroup, activeRole } = session;

  const [adminTab, setAdminTab] = useState<
    'dashboard' | 'membros' | 'solicitacoes' | 'reservas' | 'classes' | 'relatorios' | 'config'
  >(initialTab || 'dashboard');
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  const currentMember = session.membros.find(m => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id);
  const isOwner = currentMember?.perfil === 'PROPRIETARIO' && currentMember?.status === 'ATIVO';

  useEffect(() => {
    if (initialTab) {
      setAdminTab(initialTab);
    }
  }, [initialTab]);

  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  const [searchTerm, setSearchTerm] = useState('');

  const [groupMembers, setGroupMembers] = useState<MembroGrupo[]>([]);
  const [todayBookings, setTodayBookings] = useState<Reserva[]>([]);
  const [courtConfig, setCourtConfig] = useState<CourtConfig>({
    grupo_id: activeGroup?.id || '',
    data: todayStr,
    qtd_quadras: 4,
    horarios: [],
    prazo_cancelamento_horas: 2
  });

  // Group Classes Management State
  const [enabledClasses, setEnabledClasses] = useState<PlayerClass[]>([]);
  const [customClassName, setCustomClassName] = useState('');
  const [targetMassClass, setTargetMassClass] = useState<PlayerClass>('Classe D (4º)');
  const [saveClassesSuccessMsg, setSaveClassesSuccessMsg] = useState(false);

  // Owner-only Class Confirmation Modal
  const [classModal, setClassModal] = useState<{ member: MembroGrupo; newClass: PlayerClass } | null>(null);
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);

  // Mandatory Class Approval Modal
  const [approvalModal, setApprovalModal] = useState<{
    member: MembroGrupo;
    selectedClass: PlayerClass | '';
    errorMessage?: string;
  } | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  const APPROVAL_CLASSES: { value: PlayerClass; label: string }[] = [
    { value: 'Classe A (1º)', label: 'Classe A (1º)' },
    { value: 'Classe B (2º)', label: 'Classe B (2º)' },
    { value: 'Classe C (3º)', label: 'Classe C (3º)' },
    { value: 'Classe D (4º)', label: 'Classe D (4º)' },
    { value: 'Classe E (5º)', label: 'Classe E (5º)' },
    { value: 'Classe F (6º)', label: 'Classe F (6º)' },
    { value: 'Classe G (7º)', label: 'Classe G (7º)' },
    { value: 'Classe Infantil', label: 'Classe Infantil' },
    { value: 'Classe Juvenil', label: 'Classe Juvenil' },
    { value: 'Classe (50+)', label: 'Classe 50+' },
  ];

  useEffect(() => {
    if (activeGroup) {
      const groupClasses = DbService.getGroupClasses(activeGroup.id);
      setEnabledClasses(groupClasses);
    }
  }, [activeGroup?.id]);

  const allAvailableClassesList = Array.from(new Set([...DEFAULT_PLAYER_CLASSES, ...enabledClasses]));

  const handleToggleClass = (cls: PlayerClass) => {
    if (enabledClasses.includes(cls)) {
      if (enabledClasses.length <= 1) {
        toast.error('O grupo deve manter pelo menos uma classe habilitada.');
        return;
      }
      setEnabledClasses(enabledClasses.filter((c) => c !== cls));
    } else {
      setEnabledClasses([...enabledClasses, cls]);
    }
  };

  const handleAddCustomClass = () => {
    const trimmed = customClassName.trim();
    if (!trimmed) return;
    const newCls = (trimmed.startsWith('Classe') ? trimmed : `Classe ${trimmed}`) as PlayerClass;
    if (enabledClasses.includes(newCls)) {
      toast.error('Esta classe já está na lista.');
      return;
    }
    setEnabledClasses([...enabledClasses, newCls]);
    setCustomClassName('');
  };

  const handleSaveClassesConfig = () => {
    if (!activeGroup) return;
    DbService.saveGroupClasses(activeGroup.id, enabledClasses);
    toast.success('Configuração de classes salva com sucesso!');
    setSaveClassesSuccessMsg(true);
    setTimeout(() => setSaveClassesSuccessMsg(false), 4000);
  };

  const unclassedMembers = groupMembers.filter((m) => m.status === 'ATIVO' && (!m.classe || m.classe === 'Sem Classe'));

  const handleMassReassignClass = async () => {
    if (!activeGroup || unclassedMembers.length === 0) return;
    if (!podeAlterarClasse(session)) {
      toast.error('Somente o proprietário do grupo pode atribuir ou alterar classes.');
      return;
    }
    if (!confirm(`Deseja atribuir a classe "${targetMassClass}" para todos os ${unclassedMembers.length} atletas sem classe?`)) return;

    try {
      for (const m of unclassedMembers) {
        await DbService.updateMemberClass(m.id, targetMassClass, activeGroup.id);
      }
      await loadAdminData();
      onRefreshSession();
      toast.success(`Todos os ${unclassedMembers.length} atletas foram atualizados para "${targetMassClass}"!`);
    } catch (err: any) {
      await loadAdminData();
      toast.error(err.message || 'Não foi possível atualizar as classes. Tente novamente.');
    }
  };

  const loadAdminData = async () => {
    if (!activeGroup) return;

    const members = await DbService.getGroupMembers(activeGroup.id);
    setGroupMembers(members);

    const config = await DbService.getGroupCourtConfig(activeGroup.id, selectedDate);
    setCourtConfig(config);

    const bookings = await DbService.getBookingsForDate(activeGroup.id, selectedDate);
    setTodayBookings(bookings);
  };

  useEffect(() => {
    loadAdminData();
  }, [activeGroup?.id, selectedDate]);

  if (!activeGroup || !user) return null;

  const pendingMembers = groupMembers.filter((m) => m.status === 'PENDENTE');
  const activeMembers = groupMembers.filter((m) => m.status === 'ATIVO');
  const blockedMembers = groupMembers.filter((m) => m.status === 'BLOQUEADO');

  const totalPossibleSlots = (courtConfig.qtd_quadras || 4) * (courtConfig.horarios?.length || 1);
  const occupancyRate = Math.round((todayBookings.length / (totalPossibleSlots || 1)) * 100);

  // Actions
  const handleOpenApprovalModal = (member: MembroGrupo) => {
    setApprovalModal({
      member,
      selectedClass: '',
      errorMessage: undefined,
    });
  };

  const handleConfirmApproval = async () => {
    if (!approvalModal || isApproving || !approvalModal.selectedClass) return;
    const { member, selectedClass } = approvalModal;

    setIsApproving(true);
    setApprovalModal((prev) => (prev ? { ...prev, errorMessage: undefined } : null));

    try {
      const result = await DbService.approveMemberWithClass(member.id, selectedClass);
      await loadAdminData();
      onRefreshSession();
      toast.success(result.message || `${member.usuario?.nome || 'Jogador'} foi aprovado na ${selectedClass}.`);
      setApprovalModal(null);
    } catch (err: any) {
      console.error('[Erro na aprovação do jogador no AdminPanel]:', err);
      const msg = err.message || 'Erro ao aprovar jogador. Verifique suas permissões.';
      toast.error(msg);
      setApprovalModal((prev) => (prev ? { ...prev, errorMessage: msg } : null));
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmClassUpdate = async () => {
    if (!classModal || isSubmittingClass || !activeGroup) return;
    const { member, newClass } = classModal;
    const isSelf = member.usuario_id === user?.id;
    const memberName = member.usuario?.nome || 'jogador';

    setIsSubmittingClass(true);
    try {
      await DbService.updateMemberClass(member.id, newClass, activeGroup.id);
      await loadAdminData();
      onRefreshSession();
      toast.success(formatClassUpdateToastMessage(isSelf, memberName, newClass));
      setClassModal(null);
    } catch (err: any) {
      console.error('Erro ao atualizar classe no painel admin:', err);
      toast.error(err.message || 'Não foi possível atualizar a classe. Somente o proprietário tem permissão.');
      await loadAdminData();
    } finally {
      setIsSubmittingClass(false);
    }
  };

  const handleBlockMember = async (memberId: string) => {
    if (!confirm('Deseja bloquear o acesso deste jogador?')) return;
    try {
      await DbService.updateMemberStatus(memberId, 'BLOQUEADO');
      await loadAdminData();
      onRefreshSession();
      toast.success('Jogador bloqueado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao bloquear.');
    }
  };

  const handleUnblockMember = async (memberId: string) => {
    try {
      await DbService.updateMemberStatus(memberId, 'ATIVO');
      await loadAdminData();
      onRefreshSession();
      toast.success('Jogador desbloqueado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao desbloquear.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* HEADER BAR */}
      <div className="bg-white text-indigo-950 rounded-3xl p-6 border border-purple-100/80 shadow-lilac flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-xl border border-purple-200">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-indigo-950">Painel Administrativo</h2>
            <p className="text-xs text-slate-500 font-medium">
              Gerenciamento completo do grupo {activeGroup.nome}
            </p>
          </div>
        </div>

        {/* ADMIN NAV MENU */}
        <div className="flex items-center gap-1 bg-purple-50/80 p-1.5 rounded-2xl border border-purple-100 overflow-x-auto max-w-full">
          <button
            onClick={() => setAdminTab('dashboard')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              adminTab === 'dashboard' ? 'bg-violet-700 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-950 hover:bg-white/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setAdminTab('membros')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              adminTab === 'membros' ? 'bg-violet-700 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-950 hover:bg-white/60'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Membros ({activeMembers.length})</span>
          </button>

          <button
            onClick={() => setAdminTab('solicitacoes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 relative ${
              adminTab === 'solicitacoes' ? 'bg-violet-700 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-950 hover:bg-white/60'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Solicitações</span>
            {pendingMembers.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setAdminTab('reservas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              adminTab === 'reservas' ? 'bg-violet-700 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-950 hover:bg-white/60'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Reservas</span>
          </button>

          <button
            onClick={() => setAdminTab('classes')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              adminTab === 'classes' ? 'bg-violet-700 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-950 hover:bg-white/60'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Classes de Jogadores</span>
          </button>

          <button
            onClick={() => setAdminTab('relatorios')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              adminTab === 'relatorios' ? 'bg-violet-700 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-950 hover:bg-white/60'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Relatórios</span>
          </button>

          <button
            onClick={() => setAdminTab('config')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              adminTab === 'config' ? 'bg-violet-700 text-white shadow-xs' : 'text-slate-600 hover:text-indigo-950 hover:bg-white/60'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurações</span>
          </button>
        </div>
      </div>

      {/* 1. DASHBOARD TAB */}
      {adminTab === 'dashboard' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* KPI CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Jogadores</span>
              <span className="text-2xl font-black text-slate-900">{activeMembers.length}</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pendentes</span>
              <span className="text-2xl font-black text-amber-600">{pendingMembers.length}</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Bloqueados</span>
              <span className="text-2xl font-black text-rose-600">{blockedMembers.length}</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Reservas Hoje</span>
              <span className="text-2xl font-black text-blue-600">{todayBookings.length}</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Quadras Ativas</span>
              <span className="text-2xl font-black text-emerald-600">{courtConfig.qtd_quadras}</span>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Taxa de Ocupação</span>
              <span className="text-2xl font-black text-purple-600">{occupancyRate}%</span>
            </div>
          </div>

          {/* RECENT MEMBERS & TODAY BOOKINGS SUMMARY */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Recent Registrations */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-black text-slate-900 text-base flex items-center justify-between">
                <span>Últimos Jogadores Cadastrados</span>
                <span className="text-xs font-bold text-emerald-600">{groupMembers.length} Total</span>
              </h3>

              <div className="divide-y divide-slate-100">
                {groupMembers.slice(0, 5).map((m) => (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 font-bold text-slate-700 flex items-center justify-center text-xs">
                        {m.usuario?.nome ? m.usuario.nome.substring(0, 2) : 'U'}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-xs">{m.usuario?.nome}</p>
                        <p className="text-[10px] text-slate-400">{m.usuario?.email}</p>
                      </div>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-[10px] font-bold uppercase ${
                        m.status === 'ATIVO'
                          ? 'bg-emerald-100 text-emerald-900'
                          : m.status === 'PENDENTE'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-rose-100 text-rose-900'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today Bookings Overview */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-black text-slate-900 text-base flex items-center justify-between">
                <span>Reservas do Dia ({selectedDate})</span>
                <span className="text-xs font-bold text-blue-600">{todayBookings.length} Reservadas</span>
              </h3>

              {todayBookings.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center font-medium">
                  Nenhuma reserva feita para o dia de hoje.
                </p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {todayBookings.map((b) => (
                    <div key={b.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-slate-900">
                          Quadra {b.quadra_numero} — {b.horario_label}
                        </p>
                        <p className="text-slate-500">{b.jogador_nome} ({b.jogador_classe || 'Sem Classe'})</p>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-blue-50 text-blue-800 font-bold border border-blue-200">
                        Confirmado
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}

      {/* 2. MEMBERS TAB */}
      {adminTab === 'membros' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <h3 className="font-black text-slate-900 text-lg">Membros do Grupo ({activeMembers.length})</h3>
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar membro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {activeMembers
              .filter(m => (m.usuario?.nome || '').toLowerCase().includes(searchTerm.toLowerCase()))
              .map((m) => {
                const isTargetOwner = m.perfil === 'PROPRIETARIO';
                const isSelf = user?.id === m.usuario_id;
                const canChangeClass = podeAlterarClasse(session);

                return (
                  <div key={m.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 font-black flex items-center justify-center text-xs">
                        {m.usuario?.nome ? m.usuario.nome.substring(0, 2) : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-slate-900 text-sm">{m.usuario?.nome}</p>
                          {isTargetOwner && (
                            <span className="px-2 py-0.5 rounded-md bg-[#0B1633] text-[#ccff00] text-[10px] font-black uppercase tracking-wider">
                              Proprietário {isSelf ? '(Você)' : ''}
                            </span>
                          )}
                          {m.perfil === 'ADMINISTRADOR' && (
                            <span className="px-2 py-0.5 rounded-md bg-indigo-950 text-white text-[10px] font-black uppercase tracking-wider">
                              Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500">{m.usuario?.email} • 📱 {m.usuario?.whatsapp}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      {/* Class Badge (Somente leitura para todos na listagem) */}
                      <span className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
                        {m.classe || 'Sem Classe'}
                      </span>

                      {/* Botão de Alterar Classe (Exclusivo para o Proprietário) */}
                      {canChangeClass && (
                        <button
                          type="button"
                          onClick={() => setClassModal({ member: m, newClass: m.classe || 'Sem Classe' })}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1.5 transition-all shadow-2xs"
                          title="Alterar classe do jogador (Exclusivo para o Proprietário)"
                        >
                          <Sliders className="w-3.5 h-3.5 text-slate-600" />
                          <span>Alterar classe</span>
                        </button>
                      )}

                      {!isTargetOwner && (
                        <button
                          onClick={() => handleBlockMember(m.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 cursor-pointer"
                        >
                          Bloquear
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 3. SOLICITAÇÕES TAB */}
      {adminTab === 'solicitacoes' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
          <h3 className="font-black text-slate-900 text-lg">Solicitações Pendentes ({pendingMembers.length})</h3>

          {pendingMembers.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center font-medium">
              Não há nenhuma solicitação pendente de adesão no momento.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {pendingMembers.map((m) => (
                <div key={m.id} className="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-900 font-bold flex items-center justify-center text-xs">
                      {m.usuario?.nome ? m.usuario.nome.substring(0, 2) : 'P'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{m.usuario?.nome}</p>
                      <p className="text-xs text-slate-500">{m.usuario?.email} • 📱 {m.usuario?.whatsapp}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenApprovalModal(m)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95 transition-all"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Aprovar Jogador</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 5. RESERVAS TAB */}
      {adminTab === 'reservas' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-slate-900 text-lg">Visão Geral de Todas as Reservas</h3>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border text-xs font-bold"
            />
          </div>

          <div className="divide-y divide-slate-100">
            {todayBookings.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-900">Quadra {b.quadra_numero} — {b.horario_label}</p>
                  <p className="text-slate-500">Jogador: {b.jogador_nome} ({b.jogador_classe || 'Sem Classe'})</p>
                </div>
                <button
                  onClick={async () => {
                    if (confirm('Cancelar esta reserva como Admin?')) {
                      try {
                        await DbService.cancelBooking(b.id, user.id, 'ADMINISTRADOR');
                        toast.success('Reserva cancelada com sucesso.');
                        onRefreshSession();
                      } catch (err: any) {
                        toast.error(err.message || 'Erro ao cancelar reserva.');
                      }
                    }
                  }}
                  className="px-3 py-1 rounded-xl bg-rose-600 text-white font-bold"
                >
                  Cancelar Admin
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. CLASSES TAB */}
      {adminTab === 'classes' && (
        <div className="bg-white rounded-3xl p-6 border border-purple-100/80 shadow-lilac space-y-6 animate-in fade-in duration-150">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-lg border border-purple-200">
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg">Configuração de Classes do Grupo</h3>
                <p className="text-xs text-slate-500">
                  Gerencie as classes ativas e crie novas categorias disponíveis para os atletas no grupo <strong className="text-slate-800">{activeGroup.nome}</strong>.
                </p>
              </div>
            </div>

            <button
              onClick={handleSaveClassesConfig}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Salvar Configuração de Classes</span>
            </button>
          </div>

          {saveClassesSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Configurações de classes do grupo salvas com sucesso! As alterações já estão disponíveis no sistema.</span>
            </div>
          )}

          {/* LISTA DE CLASSES E SWITCHES */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-violet-600" />
              <span>Classes Habilitadas no Grupo ({enabledClasses.length} de {allAvailableClassesList.length} ativas)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {allAvailableClassesList.map((cls) => {
                const isEnabled = enabledClasses.includes(cls);
                const memberCount = groupMembers.filter((m) => m.status === 'ATIVO' && m.classe === cls).length;

                return (
                  <div
                    key={cls}
                    onClick={() => handleToggleClass(cls)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isEnabled
                        ? 'bg-purple-50/40 border-purple-200 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <input
                        type="checkbox"
                        checked={isEnabled}
                        onChange={() => {}}
                        className="w-4 h-4 rounded text-violet-600 focus:ring-violet-500 cursor-pointer"
                      />
                      <div>
                        <span className="font-extrabold text-xs text-slate-900 block truncate">{cls}</span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {memberCount} {memberCount === 1 ? 'atleta' : 'atletas'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        isEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isEnabled ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ADICIONAR CLASSE PERSONALIZADA */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-slate-700" />
              <span>Criar Nova Classe Personalizada</span>
            </h4>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <input
                type="text"
                value={customClassName}
                onChange={(e) => setCustomClassName(e.target.value)}
                placeholder="Ex: Classe Mista, Classe Sênior, Classe Principiante..."
                className="w-full sm:flex-1 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <button
                onClick={handleAddCustomClass}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-extrabold text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Adicionar Classe</span>
              </button>
            </div>
          </div>

          {/* ATRIBUIR CLASSE AOS INTEGRANTES (INCLUINDO PROPRIETÁRIO) */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-violet-700" />
              <span>Classes Atribuídas aos Integrantes do Grupo</span>
            </h4>
            <p className="text-xs text-slate-500">
              Defina individualmente a classe de cada membro do clube. O proprietário e os administradores têm sua classe atualizada imediatamente.
            </p>

            <div className="divide-y divide-slate-200/60 bg-white rounded-2xl p-4 border border-slate-200 space-y-2">
              {activeMembers.map((m) => {
                const isTargetOwner = m.perfil === 'PROPRIETARIO';
                const isSelf = user?.id === m.usuario_id;
                const canChangeClass = podeAlterarClasse(session);

                return (
                  <div key={m.id} className="pt-2.5 pb-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-900 font-extrabold flex items-center justify-center text-xs">
                        {m.usuario?.nome ? m.usuario.nome.substring(0, 2) : 'U'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-xs">{m.usuario?.nome}</span>
                          {isTargetOwner && (
                            <span className="px-1.5 py-0.5 rounded bg-[#0B1633] text-[#ccff00] text-[9px] font-black uppercase tracking-wider">
                              Proprietário {isSelf ? '(Você)' : ''}
                            </span>
                          )}
                          {m.perfil === 'ADMINISTRADOR' && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-950 text-white text-[9px] font-black uppercase tracking-wider">
                              Admin
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">{m.usuario?.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Classe:</span>
                      <span className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold border border-slate-200">
                        {m.classe || 'Sem Classe'}
                      </span>
                      {canChangeClass && (
                        <button
                          type="button"
                          onClick={() => setClassModal({ member: m, newClass: m.classe || 'Sem Classe' })}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200 cursor-pointer flex items-center gap-1 transition-all"
                          title="Alterar classe do jogador"
                        >
                          <Sliders className="w-3 h-3 text-slate-600" />
                          <span>Alterar</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AÇÕES EM LOTE PARA JOGADORES SEM CLASSE */}
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
            <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-amber-700" />
              <span>Atribuição em Lote para Atletas "Sem Classe"</span>
            </h4>
            <p className="text-xs text-amber-800">
              Existem <strong className="font-black text-amber-950">{unclassedMembers.length}</strong> atletas cadastrados atualmente como <strong className="underline">Sem Classe</strong>. Você pode atribuí-los todos juntos para uma classe ativa:
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-2">
              <select
                value={targetMassClass}
                onChange={(e) => setTargetMassClass(e.target.value as PlayerClass)}
                className="w-full sm:w-auto px-3.5 py-2 rounded-xl bg-white border border-amber-200 text-xs font-extrabold text-slate-900 focus:outline-none"
              >
                {enabledClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
              <button
                onClick={handleMassReassignClass}
                disabled={unclassedMembers.length === 0}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold text-xs shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Atribuir {unclassedMembers.length} Atletas em Lote</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. RELATÓRIOS TAB */}
      {adminTab === 'relatorios' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in duration-150">
          <h3 className="font-black text-slate-900 text-lg">Relatórios & Métricas de Uso</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="font-bold text-xs uppercase text-slate-500">Taxa de Ocupação Hoje</h4>
              <p className="text-3xl font-black text-emerald-600">{occupancyRate}%</p>
              <p className="text-xs text-slate-400">Total de {todayBookings.length} de {totalPossibleSlots} vagas preenchidas.</p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <h4 className="font-bold text-xs uppercase text-slate-500">Total de Jogadores Ativos</h4>
              <p className="text-3xl font-black text-blue-600">{activeMembers.length}</p>
              <p className="text-xs text-slate-400">Atletas cadastrados e liberados para jogar.</p>
            </div>
          </div>
        </div>
      )}

      {/* 7. CONFIGURAÇÕES TAB */}
      {adminTab === 'config' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in duration-150">
          <h3 className="font-black text-slate-900 text-lg">Configurações do Grupo</h3>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <GroupAvatar
              group={activeGroup}
              isOwner={isOwner}
              onClickEdit={() => setIsImageModalOpen(true)}
              size="xl"
            />
            <div className="space-y-1">
              <h4 className="font-black text-slate-900 text-base">{activeGroup.nome}</h4>
              <p className="text-xs text-slate-500 font-medium">
                {isOwner ? 'Você pode alterar a imagem oficial do grupo.' : 'Imagem oficial do grupo de tênis.'}
              </p>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(true)}
                  className="mt-2 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  Alterar imagem do grupo
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 text-xs text-slate-700">
            <p><strong>Nome do Grupo:</strong> {activeGroup.nome}</p>
            <p><strong>Cidade/Estado:</strong> {formatLocation(activeGroup.cidade, activeGroup.estado)}</p>
            <p><strong>Código de Convite:</strong> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border">{activeGroup.codigo_convite}</span></p>
          </div>
        </div>
      )}

      {activeGroup && (
        <GroupImageModal
          group={activeGroup}
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          onRefreshSession={onRefreshSession}
        />
      )}

      {/* OWNER-ONLY CLASS CONFIRMATION MODAL */}
      {classModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0F172A] text-[#ccff00] flex items-center justify-center font-black">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 text-base">Alterar Classe do Jogador</h3>
              </div>
              <button
                onClick={() => !isSubmittingClass && setClassModal(null)}
                disabled={isSubmittingClass}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Jogador:</span>
                  <strong className="text-slate-900 text-xs font-black">{classModal.member.usuario?.nome}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Classe Atual:</span>
                  <span className="font-extrabold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-lg border border-amber-300/80">
                    {classModal.member.classe || 'Sem Classe'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-600 block">Selecione a Nova Classe:</label>
                <select
                  value={classModal.newClass}
                  disabled={isSubmittingClass}
                  onChange={(e) => setClassModal({ ...classModal, newClass: e.target.value as PlayerClass })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
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

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                ℹ️ <strong>Regra de Negócio:</strong> Somente o proprietário do grupo possui permissão para definir ou alterar o nível técnico dos jogadores.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClassModal(null)}
                disabled={isSubmittingClass}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClassUpdate}
                disabled={isSubmittingClass}
                className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-extrabold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingClass ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#ccff00] border-t-transparent rounded-full animate-spin" />
                    <span>Alterando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar Alteração</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. MANDATORY CLASS PLAYER APPROVAL MODAL */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Aprovar jogador</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Confirmação de entrada no grupo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isApproving && setApprovalModal(null)}
                disabled={isApproving}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-xs">
              {/* Dynamic message */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 font-medium leading-relaxed">
                Defina a classe de <strong className="font-black text-emerald-900">{approvalModal.member.usuario?.nome || 'este jogador'}</strong> para concluir a aprovação.
              </div>

              {/* Player Info Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Jogador:</span>
                  <strong className="text-slate-900 text-xs font-black">{approvalModal.member.usuario?.nome}</strong>
                </div>
                {approvalModal.member.usuario?.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">E-mail:</span>
                    <span className="text-slate-700 text-xs font-medium">{approvalModal.member.usuario.email}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Status Atual:</span>
                  <span className="font-extrabold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-300">
                    PENDENTE
                  </span>
                </div>
              </div>

              {/* Mandatory Class Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>Classe do jogador</span>
                  <span className="text-rose-500 font-black">*</span>
                </label>
                <select
                  value={approvalModal.selectedClass}
                  disabled={isApproving}
                  onChange={(e) =>
                    setApprovalModal({
                      ...approvalModal,
                      selectedClass: e.target.value as PlayerClass,
                      errorMessage: undefined,
                    })
                  }
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
                >
                  <option value="" disabled>
                    Selecione a classe obrigatória...
                  </option>
                  {APPROVAL_CLASSES.map((cls) => (
                    <option key={cls.value} value={cls.value}>
                      {cls.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 font-medium">
                  A definição de classe é obrigatória para que o jogador possa participar do ranking e desafios.
                </p>
              </div>

              {/* Error message if any */}
              {approvalModal.errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{approvalModal.errorMessage}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovalModal(null)}
                disabled={isApproving}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={!approvalModal.selectedClass || isApproving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isApproving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Aprovando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Aprovar jogador</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
