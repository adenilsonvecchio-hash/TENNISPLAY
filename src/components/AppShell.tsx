import React, { useState, useEffect } from 'react';
import { AuthSession, Grupo, Notificacao } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import { formatLocation } from '../lib/location';
import { GroupAvatar } from './GroupAvatar';
import { NotificationCenter } from './NotificationCenter';
import {
  Home,
  Calendar,
  CalendarDays,
  CalendarCheck,
  Users,
  Bell,
  User,
  ChevronDown,
  Building2,
  CheckCircle2,
  PlusCircle,
  Shield,
  Eye,
  LogOut,
  X,
  BookOpen,
  Sliders,
  ShieldAlert,
  History,
  Copy,
  Check,
  Tag,
  KeyRound,
  Clock
} from 'lucide-react';

interface AppShellProps {
  session: AuthSession;
  onUpdateSession: (session: AuthSession | null) => void;
  onOpenCreateGroup: () => void;
  onOpenManualPdf: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewMode?: 'MANAGER' | 'PLAYER';
  onToggleViewMode?: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  session,
  onUpdateSession,
  onOpenCreateGroup,
  onOpenManualPdf,
  activeTab,
  setActiveTab,
  viewMode = 'MANAGER',
  onToggleViewMode,
  children
}) => {
  const { user, activeGroup } = session;

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showMobileNotifications, setShowMobileNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [userGroups, setUserGroups] = useState<{ group: Grupo; member: any }[]>([]);

  useEffect(() => {
    if (user && activeGroup) {
      DbService.getUserNotifications(user.id, activeGroup.id).then((notifs) => {
        setNotifications(notifs);
      });
    }
  }, [user?.id, activeGroup?.id, showMobileNotifications]);

  useEffect(() => {
    if (user) {
      DbService.getGroupsForUser(user.id).then((groups) => {
        setUserGroups(groups);
      });
    }
  }, [user?.id, activeGroup?.id]);

  const unreadCount = notifications.filter(n => !n.lida).length;

  const handleMarkAsRead = async (id: string) => {
    await DbService.markNotificationRead(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, lida: true } : n))
    );
  };

  const handleSwitchGroup = async (groupId: string) => {
    if (!user) return;
    try {
      const newSession = await DbService.switchGroup(user.id, groupId);
      onUpdateSession(newSession);
      setShowGroupModal(false);
      toast.success('Grupo alterado com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao trocar de grupo.');
    }
  };

  const handleLogout = async () => {
    await DbService.logout();
    onUpdateSession(null);
  };

  const currentMember = session.membros.find(
    (m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id
  );
  const userRole = currentMember?.perfil || session.activeRole || 'JOGADOR';
  const userStatus = currentMember?.status || 'PENDENTE';

  const isOwnerOrAdmin = (userRole === 'PROPRIETARIO' || userRole === 'ADMINISTRADOR') && userStatus === 'ATIVO';

  const getRoleBadgeLabel = (perfil: string | null) => {
    switch (perfil) {
      case 'PROPRIETARIO':
        return 'PROPRIETÁRIO';
      case 'ADMINISTRADOR':
        return 'ADMINISTRADOR';
      default:
        return 'JOGADOR';
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `Há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Há ${hours} h`;
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-[#111827] font-sans selection:bg-[#ccff00] selection:text-[#0F172A] relative overflow-x-hidden">
      
      {/* 1. CABEÇALHO SUPERIOR FIXO */}
      <header
        className="fixed top-0 left-0 right-0 z-30 h-14 sm:h-16 bg-[#0F172A] text-white border-b border-slate-800 shadow-md flex items-center justify-between px-3 sm:px-6 select-none"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
          
          {/* LADO ESQUERDO: Nome do grupo atual (clicável para trocar de grupo) */}
          <div className="flex items-center gap-4">
            {activeGroup ? (
              <button
                onClick={() => setShowGroupModal(true)}
                aria-label="Trocar grupo de tênis"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-white border border-slate-700 transition-all max-w-[180px] sm:max-w-[260px] md:max-w-[320px] cursor-pointer"
              >
                <GroupAvatar group={activeGroup} size="xs" isOwner={false} shape="rounded-full" />
                <span className="text-xs sm:text-sm font-extrabold truncate tracking-tight text-white">
                  {activeGroup.nome}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </button>
            ) : (
              <div className="text-xs font-bold text-[#ccff00]">TennisPlay</div>
            )}

            {/* Navegação Desktop (Visível em telas >= 768px) */}
            <nav className="hidden md:flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab('overview')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'overview'
                    ? 'bg-slate-800 text-[#ccff00]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Início
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('agenda')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'agenda'
                    ? 'bg-slate-800 text-[#ccff00]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Agenda
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('historico')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'historico'
                    ? 'bg-slate-800 text-[#ccff00]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Reservas
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('members')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  activeTab === 'members'
                    ? 'bg-slate-800 text-[#ccff00]'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                Jogadores
              </button>

              {isOwnerOrAdmin && (
                <button
                  type="button"
                  onClick={() => setActiveTab('admin_panel')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    activeTab === 'admin_panel' || activeTab === 'admin_classes'
                      ? 'bg-slate-800 text-[#ccff00]'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Painel Admin
                </button>
              )}
            </nav>
          </div>

          {/* LADO DIREITO: Ícones (Jogadores, Notificações, Avatar) */}
          <div className="flex items-center gap-1 sm:gap-2">
            
            {/* Ícone de Jogadores/Membros */}
            <button
              onClick={() => setActiveTab('members')}
              aria-label="Membros e Jogadores"
              title="Jogadores do grupo"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Users className="w-5 h-5" />
            </button>

            {/* Ícone de Notificações com contador */}
            <NotificationCenter session={session} />

            {/* Avatar do Usuário */}
            <div className="relative">
              <button
                onClick={() => setShowAvatarMenu(!showAvatarMenu)}
                aria-label="Menu do Usuário"
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center overflow-hidden transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#ccff00]"
              >
                {user?.foto_url ? (
                  <img
                    src={user.foto_url}
                    alt={user.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#0F172A] text-slate-200 font-black text-xs flex items-center justify-center uppercase">
                    {user?.nome ? user.nome.substring(0, 2) : 'U'}
                  </div>
                )}
              </button>

              {/* Menu do Avatar (Dropdown) */}
              {showAvatarMenu && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onMouseLeave={() => setShowAvatarMenu(false)}
                >
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-extrabold text-slate-900 truncate">{user?.nome}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    
                    {/* Selo do Perfil */}
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#0F172A] text-[#ccff00] text-[10px] font-black uppercase tracking-wider">
                        {getRoleBadgeLabel(userRole)}
                      </span>
                    </div>
                  </div>

                  {/* Alternar visão de gestor vs jogador (se Owner ou Admin) */}
                  {isOwnerOrAdmin && onToggleViewMode && (
                    <div className="p-1.5 border-b border-slate-100">
                      <button
                        onClick={() => {
                          onToggleViewMode();
                          setShowAvatarMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 hover:bg-slate-100 text-slate-900 flex items-center justify-between transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {viewMode === 'MANAGER' ? (
                            <Eye className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Shield className="w-4 h-4 text-[#0F172A]" />
                          )}
                          <span>{viewMode === 'MANAGER' ? 'Ver como jogador' : 'Visão de gestor'}</span>
                        </div>
                      </button>
                    </div>
                  )}

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowAvatarMenu(false);
                        setActiveTab('profile');
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-500" />
                      Meu Perfil
                    </button>

                    <button
                      onClick={() => {
                        setShowAvatarMenu(false);
                        onOpenManualPdf();
                      }}
                      className="w-full text-left px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <BookOpen className="w-4 h-4 text-slate-500" />
                      Manual de Ajuda (PDF)
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2.5 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      Sair do Sistema
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </header>

      {/* 2. CONTEÚDO CENTRAL ROLÁVEL */}
      <main className="flex-1 overflow-y-auto pt-16 sm:pt-20 pb-24 md:pb-12 w-full max-w-[1200px] mx-auto px-3 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* 3. MENU INFERIOR FIXO NO CELULAR (BOTTOM NAVIGATION < 768px) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-[#0F172A] text-white border-t border-slate-800 shadow-2xl h-16 flex items-center justify-around px-2 select-none md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="w-full mx-auto flex items-center justify-around">
          
          {/* 1. INÍCIO */}
          <button
            onClick={() => setActiveTab('overview')}
            aria-label="Início"
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'text-[#ccff00] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Início</span>
          </button>

          {/* 2. AGENDA */}
          <button
            onClick={() => setActiveTab('agenda')}
            aria-label="Agenda"
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              activeTab === 'agenda' ? 'text-[#ccff00] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CalendarDays className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Agenda</span>
          </button>

          {/* 3. RESERVAS */}
          <button
            onClick={() => setActiveTab('historico')}
            aria-label="Reservas"
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              activeTab === 'historico' ? 'text-[#ccff00] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <CalendarCheck className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Reservas</span>
          </button>

          {/* 4. NOTIFICAÇÕES */}
          <button
            onClick={() => setShowMobileNotifications(true)}
            aria-label="Notificações"
            className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              showMobileNotifications ? 'text-[#ccff00] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <div className="relative">
              <Bell className="w-5 h-5 mb-0.5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 w-4 h-4 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-[#0F172A]">
                  {unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight">Notificações</span>
          </button>

          {/* 5. PERFIL */}
          <button
            onClick={() => setActiveTab('profile')}
            aria-label="Perfil"
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              activeTab === 'profile' ? 'text-[#ccff00] font-bold' : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Perfil</span>
          </button>

        </div>
      </nav>

      {/* MODAL / SHEET: NOTIFICAÇÕES NO CELULAR */}
      {showMobileNotifications && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center p-0 md:hidden animate-in fade-in duration-150">
          <div
            className="bg-white rounded-t-3xl p-5 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-900" />
                <h3 className="text-base font-black text-slate-900">Notificações</h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                    {unreadCount} nova(s)
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowMobileNotifications(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto space-y-2.5">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Bell className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold">Nenhuma notificação encontrada.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      notif.lida
                        ? 'bg-slate-50 border-slate-200/80 text-slate-600'
                        : 'bg-indigo-50/50 border-indigo-200 text-slate-900 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black">{notif.titulo}</span>
                          {!notif.lida && (
                            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">{notif.mensagem}</p>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {formatTimeAgo(notif.created_at)}
                        </span>
                      </div>

                      {!notif.lida && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notif.id)}
                          className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-[10px] font-bold shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL / SHEET: TROCAR DE GRUPO */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0F172A]" />
                <h3 className="text-base font-black text-slate-900">Meus Grupos de Tênis</h3>
              </div>
              <button
                onClick={() => setShowGroupModal(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {userGroups.map(({ group, member }) => {
                const isCurrent = group.id === activeGroup?.id;
                return (
                  <button
                    key={group.id}
                    onClick={() => handleSwitchGroup(group.id)}
                    className={`w-full text-left p-3 rounded-2xl flex items-center justify-between border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#0F172A] text-white border-[#0F172A] shadow-md'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate pr-2">
                      <GroupAvatar group={group} size="sm" isOwner={false} />
                      <div className="truncate">
                        <p className="text-sm font-black truncate">{group.nome}</p>
                        <p className={`text-xs ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                          {formatLocation(group.cidade, group.estado)} • {member.perfil}
                        </p>
                      </div>
                    </div>
                    {isCurrent && <CheckCircle2 className="w-5 h-5 text-slate-300 shrink-0" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  onOpenCreateGroup();
                }}
                className="w-full py-3 px-4 rounded-2xl bg-[#0F172A] text-slate-200 font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-800"
              >
                <PlusCircle className="w-4 h-4 text-slate-200" />
                <span>Criar Novo Grupo de Tênis</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

