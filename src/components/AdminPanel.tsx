import React, { useState, useEffect } from 'react';
import { AuthSession, MembroGrupo, PlayerClass, DEFAULT_PLAYER_CLASSES, MemberStatus, Grupo, Usuario, Reserva, CourtConfig } from '../types';
import { DbService } from '../lib/db';
import { formatLocation } from '../lib/location';
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
  Tag
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
        alert('O grupo deve manter pelo menos uma classe habilitada.');
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
      alert('Esta classe já está na lista.');
      return;
    }
    setEnabledClasses([...enabledClasses, newCls]);
    setCustomClassName('');
  };

  const handleSaveClassesConfig = () => {
    if (!activeGroup) return;
    DbService.saveGroupClasses(activeGroup.id, enabledClasses);
    setSaveClassesSuccessMsg(true);
    setTimeout(() => setSaveClassesSuccessMsg(false), 4000);
  };

  const unclassedMembers = groupMembers.filter((m) => m.status === 'ATIVO' && (!m.classe || m.classe === 'Sem Classe'));

  const handleMassReassignClass = async () => {
    if (!activeGroup || unclassedMembers.length === 0) return;
    if (!confirm(`Deseja atribuir a classe "${targetMassClass}" para todos os ${unclassedMembers.length} atletas sem classe?`)) return;

    try {
      for (const m of unclassedMembers) {
        await DbService.updateMemberClass(m.id, targetMassClass);
      }
      await loadAdminData();
      alert(`Todos os ${unclassedMembers.length} atletas foram atualizados para "${targetMassClass}"!`);
    } catch (err: any) {
      alert('Erro ao reatribuir atletas em massa.');
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
  const handleApproveMember = async (memberId: string, classe: PlayerClass) => {
    try {
      await DbService.approveMemberWithClass(memberId, classe);
      await loadAdminData();
      onRefreshSession();
      alert('Jogador aprovado com sucesso!');
    } catch (err: any) {
      alert(err.message || 'Erro ao aprovar jogador.');
    }
  };

  const handleUpdateClass = async (memberId: string, classe: PlayerClass) => {
    try {
      await DbService.updateMemberClass(memberId, classe);
      await loadAdminData();
      onRefreshSession();
    } catch (err: any) {
      alert(err.message || 'Erro ao alterar classe.');
    }
  };

  const handleBlockMember = async (memberId: string) => {
    if (!confirm('Deseja bloquear o acesso deste jogador?')) return;
    try {
      await DbService.updateMemberStatus(memberId, 'BLOQUEADO');
      await loadAdminData();
      onRefreshSession();
    } catch (err: any) {
      alert(err.message || 'Erro ao bloquear.');
    }
  };

  const handleUnblockMember = async (memberId: string) => {
    try {
      await DbService.updateMemberStatus(memberId, 'ATIVO');
      await loadAdminData();
      onRefreshSession();
    } catch (err: any) {
      alert(err.message || 'Erro ao desbloquear.');
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
              .map((m) => (
                <div key={m.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-900 font-black flex items-center justify-center text-xs">
                      {m.usuario?.nome ? m.usuario.nome.substring(0, 2) : 'U'}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{m.usuario?.nome}</p>
                      <p className="text-xs text-slate-500">{m.usuario?.email} • 📱 {m.usuario?.whatsapp}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Class Selector */}
                    <select
                      value={m.classe || 'Sem Classe'}
                      onChange={(e) => handleUpdateClass(m.id, e.target.value as PlayerClass)}
                      className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
                    >
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
                      <option value="Sem Classe">Sem Classe</option>
                    </select>

                    <button
                      onClick={() => handleBlockMember(m.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200"
                    >
                      Bloquear
                    </button>
                  </div>
                </div>
              ))}
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
                      onClick={() => handleApproveMember(m.id, 'Classe C (3º)')}
                      className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] font-extrabold text-xs flex items-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Aprovar (Classe C - 3º)</span>
                    </button>
                    <button
                      onClick={() => handleApproveMember(m.id, 'Classe A (1º)')}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs"
                    >
                      Aprovar Classe A (1º)
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
                  onClick={() => {
                    if (confirm('Cancelar esta reserva como Admin?')) {
                      DbService.cancelBooking(b.id, user.id, 'ADMINISTRADOR');
                      onRefreshSession();
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
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in duration-150">
          <h3 className="font-black text-slate-900 text-lg">Configurações do Grupo</h3>
          <div className="space-y-2 text-xs text-slate-700">
            <p><strong>Nome do Grupo:</strong> {activeGroup.nome}</p>
            <p><strong>Cidade/Estado:</strong> {formatLocation(activeGroup.cidade, activeGroup.estado)}</p>
            <p><strong>Código de Convite:</strong> <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border">{activeGroup.codigo_convite}</span></p>
          </div>
        </div>
      )}

    </div>
  );
};
