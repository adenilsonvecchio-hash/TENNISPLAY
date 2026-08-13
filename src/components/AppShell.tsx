import React, { useState, useEffect } from 'react';
import { AuthSession, Grupo } from '../types';
import { DbService } from '../lib/db';
import { formatLocation } from '../lib/location';
import { AppLogo } from './AppLogo';
import { NotificationCenter } from './NotificationCenter';
import {
  Home,
  Calendar,
  Plus,
  Users,
  Menu,
  ChevronDown,
  Building2,
  CheckCircle2,
  PlusCircle,
  Shield,
  Eye,
  User,
  LogOut,
  X,
  BookOpen,
  Settings,
  ShieldAlert,
  History,
  Copy,
  Check,
  Tag,
  KeyRound,
  Sliders
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
  const { user, activeGroup, activeRole } = session;

  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);
  const [showMaisSheet, setShowMaisSheet] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const [userGroups, setUserGroups] = useState<{ group: Grupo; member: any }[]>([]);

  useEffect(() => {
    if (user) {
      DbService.getGroupsForUser(user.id).then((groups) => {
        setUserGroups(groups);
      });
    }
  }, [user?.id, activeGroup?.id]);

  const handleSwitchGroup = async (groupId: string) => {
    if (!user) return;
    try {
      const newSession = await DbService.switchGroup(user.id, groupId);
      onUpdateSession(newSession);
      setShowGroupModal(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao trocar de grupo.');
    }
  };

  const handleLogout = async () => {
    await DbService.logout();
    onUpdateSession(null);
  };

  const handleCopyInviteCode = () => {
    if (activeGroup?.codigo_convite) {
      navigator.clipboard.writeText(activeGroup.codigo_convite);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const currentMember = session.membros.find(
    (m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id
  );
  const userRole = currentMember?.perfil || session.activeRole || 'JOGADOR';
  const userStatus = currentMember?.status || 'PENDENTE';

  const isOwnerOrAdmin = (userRole === 'PROPRIETARIO' || userRole === 'ADMINISTRADOR') && userStatus === 'ATIVO';
  const isPendingMember = userStatus === 'PENDENTE';

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

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F8FC] text-[#111827] font-sans selection:bg-slate-300 selection:text-[#0B1633] relative overflow-x-hidden">
      
      {/* 1. CABEÇALHO SUPERIOR FIXO */}
      <header
        className="fixed top-0 left-0 right-0 z-30 h-14 sm:h-16 bg-[#0B1633] text-white border-b border-slate-800/80 shadow-md flex items-center justify-between px-3 sm:px-6 select-none"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-[1200px] w-full mx-auto flex items-center justify-between">
          
          {/* LADO ESQUERDO: Nome do grupo atual (clicável para trocar de grupo) */}
          {activeGroup ? (
            <button
              onClick={() => setShowGroupModal(true)}
              aria-label="Trocar grupo de tênis"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-white border border-slate-700/80 transition-all max-w-[180px] sm:max-w-[280px] md:max-w-[360px] cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <span className="text-xs sm:text-sm font-extrabold truncate tracking-tight text-white">
                {activeGroup.nome}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            </button>
          ) : (
            <div className="text-xs font-bold text-slate-400">TennisPlay</div>
          )}

          {/* LADO DIREITO: Ícones (Jogadores, Notificações, Avatar) */}
          <div className="flex items-center gap-1 sm:gap-2">
            
            {/* Ícone de Jogadores/Membros */}
            <button
              onClick={() => setActiveTab('members')}
              aria-label="Membros e Jogadores"
              title="Jogadores do grupo"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors cursor-pointer"
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
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center overflow-hidden transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                {user?.foto_url ? (
                  <img
                    src={user.foto_url}
                    alt={user.nome}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-[#0B1633] text-slate-200 font-black text-xs flex items-center justify-center uppercase">
                    {user?.nome ? user.nome.substring(0, 2) : 'U'}
                  </div>
                )}
              </button>

              {/* Menu do Avatar (Modal/Dropdown) */}
              {showAvatarMenu && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onMouseLeave={() => setShowAvatarMenu(false)}
                >
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-extrabold text-slate-900 truncate">{user?.nome}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    
                    {/* Selo discreto do Perfil */}
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded-md bg-[#0B1633] text-slate-200 text-[10px] font-black uppercase tracking-wider">
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
                            <Shield className="w-4 h-4 text-[#0B1633]" />
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
      <main className="flex-1 overflow-y-auto pt-16 sm:pt-20 pb-24 sm:pb-28 w-full max-w-[1200px] mx-auto px-3 sm:px-6 lg:px-8">
        {children}
      </main>

      {/* 3. MENU INFERIOR FIXO (BOTTOM NAVIGATION) */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-[#0B1633] text-white border-t border-slate-800/80 shadow-2xl h-16 sm:h-18 flex items-center justify-around px-2 select-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="max-w-md md:max-w-xl lg:max-w-2xl w-full mx-auto flex items-center justify-around relative">
          
          {/* 1. INÍCIO */}
          <button
            onClick={() => setActiveTab('overview')}
            aria-label="Início"
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              activeTab === 'overview' ? 'text-white font-extrabold' : 'text-[#64748B] hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Início</span>
          </button>

          {/* 2. AGENDA */}
          <button
            onClick={() => setActiveTab('agenda')}
            aria-label="Agenda de Reservas"
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              activeTab === 'agenda' ? 'text-white font-extrabold' : 'text-[#64748B] hover:text-slate-200'
            }`}
          >
            <Calendar className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Agenda</span>
          </button>

          {/* 3. NOVA RESERVA (BOTÃO CENTRAL DESTACADO) */}
          <button
            onClick={() => setActiveTab('agenda')}
            aria-label="Nova Reserva de Quadra"
            title="Nova Reserva"
            className="relative -top-4 w-13 h-13 sm:w-14 sm:h-14 rounded-full bg-[#0B1633] text-white border-4 border-[#F6F8FC] shadow-xl flex flex-col items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer ring-2 ring-slate-600 shrink-0"
          >
            <Plus className="w-6 h-6 stroke-[3]" />
          </button>

          {/* 4. JOGADORES */}
          <button
            onClick={() => setActiveTab('members')}
            aria-label="Jogadores do Grupo"
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              activeTab === 'members' ? 'text-white font-extrabold' : 'text-[#64748B] hover:text-slate-200'
            }`}
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Jogadores</span>
          </button>

          {/* 5. MAIS */}
          <button
            onClick={() => setShowMaisSheet(true)}
            aria-label="Mais opções e configurações"
            className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] px-2 py-1 transition-colors cursor-pointer ${
              showMaisSheet ? 'text-white font-extrabold' : 'text-[#64748B] hover:text-slate-200'
            }`}
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Mais</span>
          </button>

        </div>
      </nav>

      {/* MODAL / SHEET: TROCAR DE GRUPO */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#0B1633]" />
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
                    className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between border transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#0B1633] text-white border-[#0B1633] shadow-md'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div>
                      <p className="text-sm font-black truncate">{group.nome}</p>
                      <p className={`text-xs ${isCurrent ? 'text-slate-300' : 'text-slate-500'}`}>
                        {formatLocation(group.cidade, group.estado)} • {member.perfil}
                      </p>
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
                className="w-full py-3 px-4 rounded-2xl bg-[#0B1633] text-slate-200 font-extrabold text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-800"
              >
                <PlusCircle className="w-4 h-4 text-slate-200" />
                <span>Criar Novo Grupo de Tênis</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL / SHEET: MENU "MAIS" */}
      {showMaisSheet && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div
            className="bg-white rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-5 animate-in slide-in-from-bottom duration-200 max-h-[85vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(20px + env(safe-area-inset-bottom, 0px))' }}
          >
            {/* Header / Drag indicator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Menu className="w-5 h-5 text-[#0B1633]" />
                <h3 className="text-base font-black text-slate-900">Opções do TennisPlay</h3>
              </div>
              <button
                onClick={() => setShowMaisSheet(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* SEÇÕES DO MENU MAIS */}
            <div className="space-y-4">
              
              {/* SEÇÃO ADMINISTRATIVA (Apenas Proprietário / Administrador) */}
              {isOwnerOrAdmin && (
                <div className="space-y-2">
                  <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                    Administração do Grupo
                  </p>
                  
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => {
                        setActiveTab('admin_panel');
                        setShowMaisSheet(false);
                      }}
                      className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200/80 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <ShieldAlert className="w-4 h-4 text-[#0B1633]" />
                        <span>Painel de Administração</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('agenda');
                        setShowMaisSheet(false);
                      }}
                      className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200/80 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Sliders className="w-4 h-4 text-[#0B1633]" />
                        <span>Configurar Quadras e Horários</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('admin_classes');
                        setShowMaisSheet(false);
                      }}
                      className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200/80 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <Tag className="w-4 h-4 text-[#0B1633]" />
                        <span>Classes de Jogadores</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        handleCopyInviteCode();
                      }}
                      className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200/80 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        {copiedInvite ? <Check className="w-4 h-4 text-slate-800" /> : <Copy className="w-4 h-4 text-[#0B1633]" />}
                        <span>{copiedInvite ? 'Código de Convite Copiado!' : 'Convites & Código do Grupo'}</span>
                      </div>
                    </button>

                    <button
                      onClick={() => {
                        setActiveTab('admin_panel');
                        setShowMaisSheet(false);
                      }}
                      className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200/80 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <KeyRound className="w-4 h-4 text-[#0B1633]" />
                        <span>Gerenciar Administradores</span>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* SEÇÃO GERAL */}
              <div className="space-y-2">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 px-1">
                  Geral
                </p>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('historico');
                      setShowMaisSheet(false);
                    }}
                    className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200/80 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <History className="w-4 h-4 text-[#0B1633]" />
                      <span>Histórico de Reservas</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowMaisSheet(false);
                      onOpenManualPdf();
                    }}
                    className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200/80 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <BookOpen className="w-4 h-4 text-[#0B1633]" />
                      <span>Manual do Usuário (PDF)</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setActiveTab('profile');
                      setShowMaisSheet(false);
                    }}
                    className="w-full text-left p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200/80 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <User className="w-4 h-4 text-[#0B1633]" />
                      <span>Meu Perfil</span>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowMaisSheet(false);
                      handleLogout();
                    }}
                    className="w-full text-left p-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs border border-rose-200 flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <LogOut className="w-4 h-4 text-rose-600" />
                      <span>Sair do Sistema</span>
                    </div>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
};
