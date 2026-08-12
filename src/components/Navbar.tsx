import React, { useState, useEffect } from 'react';
import { AuthSession, Grupo } from '../types';
import { DbService } from '../lib/db';
import { isSupabaseConfigured } from '../lib/supabase';
import { formatLocation } from '../lib/location';
import { AppLogo } from './AppLogo';
import { NotificationCenter } from './NotificationCenter';
import {
  LogOut,
  ChevronDown,
  Building2,
  User,
  ShieldAlert,
  PlusCircle,
  CheckCircle2,
  Calendar,
  Menu,
  X,
  BookOpen,
  LayoutDashboard,
  Users,
  Eye,
  Shield
} from 'lucide-react';

interface NavbarProps {
  session: AuthSession;
  onUpdateSession: (session: AuthSession | null) => void;
  onOpenSupabaseModal: () => void;
  onOpenCreateGroup: () => void;
  onOpenManualPdf?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  viewMode?: 'MANAGER' | 'PLAYER';
  onToggleViewMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  onUpdateSession,
  onOpenSupabaseModal,
  onOpenCreateGroup,
  onOpenManualPdf,
  activeTab,
  setActiveTab,
  viewMode = 'MANAGER',
  onToggleViewMode,
}) => {
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [userGroups, setUserGroups] = useState<{ group: Grupo; member: any }[]>([]);

  useEffect(() => {
    if (session.user) {
      DbService.getGroupsForUser(session.user.id).then((groups) => {
        setUserGroups(groups);
      });
    }
  }, [session.user?.id, session.activeGroup?.id]);

  const handleSwitchGroup = async (groupId: string) => {
    if (!session.user) return;
    try {
      const newSession = await DbService.switchGroup(session.user.id, groupId);
      onUpdateSession(newSession);
      setShowGroupMenu(false);
    } catch (err: any) {
      alert(err.message || 'Erro ao trocar de grupo.');
    }
  };

  const handleLogout = async () => {
    await DbService.logout();
    onUpdateSession(null);
  };

  const getRoleBadge = (perfil: string | null) => {
    switch (perfil) {
      case 'PROPRIETARIO':
        return { label: 'PROPRIETÁRIO', bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800' };
      case 'ADMINISTRADOR':
        return { label: 'ADMINISTRADOR', bg: 'bg-slate-900 text-white border-slate-700' };
      default:
        return { label: 'JOGADOR', bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const roleBadge = getRoleBadge(session.activeRole);
  const isOwnerOrAdmin = session.activeRole === 'PROPRIETARIO' || session.activeRole === 'ADMINISTRADOR';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Active Tenant Group */}
          <div className="flex items-center gap-2.5 sm:gap-5">
            <button
              onClick={() => setActiveTab('overview')}
              className="flex items-center text-left group focus:outline-none hover:opacity-90 transition-opacity"
            >
              <AppLogo size="md" />
            </button>

            {/* Tenant Active Group Selector (Desktop only to save mobile header space) */}
            {session.activeGroup && (
              <div className="relative hidden sm:block">
                <button
                  onClick={() => setShowGroupMenu(!showGroupMenu)}
                  className="flex items-center gap-2 px-3.5 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200/80 text-slate-900 text-xs font-bold border border-slate-200 transition-colors shrink-0 cursor-pointer"
                >
                  <Building2 className="w-4 h-4 text-slate-700 shrink-0" />
                  <span className="max-w-[120px] lg:max-w-[160px] truncate font-bold">
                    {session.activeGroup.nome}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-950 bg-[#ccff00] px-1.5 py-0.5 rounded-md border border-[#ccff00]/60 hidden xl:inline-block shrink-0">
                    {formatLocation(session.activeGroup.cidade, session.activeGroup.estado)}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 ml-0.5 shrink-0" />
                </button>

                {/* Group Dropdown */}
                {showGroupMenu && (
                  <div
                    className="absolute left-0 mt-2 w-72 bg-white rounded-3xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                    onMouseLeave={() => setShowGroupMenu(false)}
                  >
                    <div className="px-4 py-2 border-b border-slate-100">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Meus Grupos ({userGroups.length})
                      </p>
                    </div>

                    <div className="max-h-60 overflow-y-auto py-1">
                      {userGroups.map(({ group, member }) => {
                        const isCurrent = group.id === session.activeGroup?.id;
                        return (
                          <button
                            key={group.id}
                            onClick={() => handleSwitchGroup(group.id)}
                            className={`w-full text-left px-4 py-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${
                              isCurrent ? 'bg-slate-100 font-bold text-slate-950' : 'text-slate-700'
                            }`}
                          >
                            <div className="truncate pr-2">
                              <p className="text-sm truncate font-semibold">{group.nome}</p>
                              <p className="text-xs text-slate-500">
                                {formatLocation(group.cidade, group.estado)} • {member.perfil}
                              </p>
                            </div>
                            {isCurrent && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-2 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setShowGroupMenu(false);
                          onOpenCreateGroup();
                        }}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-2xl text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer"
                      >
                        <PlusCircle className="w-4 h-4 text-slate-900" />
                        Criar Novo Grupo
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/90 h-10">
            {/* 1. Visão Geral */}
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 h-8 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'overview'
                  ? 'bg-[#0F172A] text-[#ccff00] shadow-sm'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/80'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Visão Geral</span>
            </button>

            {/* 2. Agenda */}
            <button
              onClick={() => setActiveTab('agenda')}
              className={`px-3.5 h-8 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'agenda'
                  ? 'bg-[#0F172A] text-[#ccff00] shadow-sm'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/80'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Agenda</span>
            </button>

            {/* 3. Jogadores */}
            <button
              onClick={() => setActiveTab('members')}
              className={`px-3.5 h-8 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                activeTab === 'members'
                  ? 'bg-[#0F172A] text-[#ccff00] shadow-sm'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-white/80'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Jogadores</span>
            </button>

            {/* 4. Administração (Owner / Admin only) */}
            {isOwnerOrAdmin && (
              <button
                onClick={() => setActiveTab('admin_panel')}
                className={`px-3.5 h-8 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  activeTab === 'admin_panel'
                    ? 'bg-[#0F172A] text-[#ccff00] shadow-sm'
                    : 'text-slate-700 hover:text-slate-950 hover:bg-white/80'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5 text-[#ccff00]" />
                <span>Administração</span>
              </button>
            )}

            {/* 5. Histórico */}
            <button
              onClick={() => setActiveTab('historico')}
              className={`px-3.5 h-8 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center cursor-pointer ${
                activeTab === 'historico'
                  ? 'bg-[#0F172A] text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-950 hover:bg-white/80'
              }`}
            >
              Histórico
            </button>
          </nav>

          {/* Right Action Items */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Manual PDF Button (Desktop only) */}
            {onOpenManualPdf && (
              <button
                onClick={onOpenManualPdf}
                title="Abrir e baixar o Manual do Usuário em PDF"
                className="hidden sm:flex items-center gap-1.5 px-3.5 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 text-xs font-bold border border-slate-200 transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <span>Manual PDF</span>
              </button>
            )}

            {/* Notifications Center (Desktop only) */}
            <div className="hidden sm:block">
              <NotificationCenter session={session} />
            </div>

            {/* User Profile Menu */}
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-2.5 h-10 rounded-2xl bg-white border border-slate-200 shadow-2xs hover:border-slate-300 transition-all shrink-0 cursor-pointer"
              >
                {session.user?.foto_url ? (
                  <img
                    src={session.user.foto_url}
                    alt={session.user.nome}
                    className="w-6 h-6 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-[#0F172A] text-[#ccff00] flex items-center justify-center font-black text-[10px] uppercase shrink-0">
                    {session.user?.nome ? session.user.nome.substring(0, 2) : 'U'}
                  </div>
                )}
                
                <div className="hidden lg:flex flex-col text-left leading-tight">
                  <p className="text-xs font-bold text-slate-900 truncate max-w-[100px]">
                    {session.user?.nome}
                  </p>
                  <span className={`inline-block px-1.5 py-0.2 rounded-md text-[9px] font-bold border ${roleBadge.bg}`}>
                    {roleBadge.label}
                  </span>
                </div>

                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block shrink-0" />
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div
                  className="absolute right-0 mt-2 w-64 bg-white rounded-3xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                  onMouseLeave={() => setShowProfileMenu(false)}
                >
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-sm font-bold text-slate-900">{session.user?.nome}</p>
                    <p className="text-xs text-slate-500 truncate">{session.user?.email}</p>
                    <p className="text-xs text-slate-700 mt-1 font-semibold">📱 {session.user?.whatsapp}</p>
                  </div>

                  {/* View Mode Switcher for Owner / Admin */}
                  {isOwnerOrAdmin && onToggleViewMode && (
                    <div className="px-2 py-1.5 border-b border-slate-100">
                      <button
                        onClick={() => {
                          onToggleViewMode();
                          setShowProfileMenu(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-900 flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {viewMode === 'MANAGER' ? (
                            <Eye className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Shield className="w-4 h-4 text-slate-900" />
                          )}
                          <span>{viewMode === 'MANAGER' ? 'Ver como jogador' : 'Visão de gestor'}</span>
                        </div>
                        <span className="text-[10px] uppercase font-black px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-800">
                          {viewMode === 'MANAGER' ? 'Gestor' : 'Jogador'}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        setActiveTab('profile');
                      }}
                      className="w-full text-left px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                    >
                      <User className="w-4 h-4 text-slate-700" />
                      Meu Perfil
                    </button>
                  </div>

                  <div className="pt-1 border-t border-slate-100">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-xs sm:text-sm font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 text-rose-600" />
                      Sair do Sistema
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 md:hidden cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden py-3 px-2 border-t border-slate-200 space-y-1 animate-in slide-in-from-top-1">
            {/* Active Group Selector for Mobile */}
            {session.activeGroup && (
              <div className="px-3 py-2 bg-slate-100 rounded-2xl mb-2 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grupo Ativo</span>
                  <span className="text-xs font-bold text-slate-900">{session.activeGroup.nome}</span>
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    setShowGroupMenu(true);
                  }}
                  className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 shadow-2xs"
                >
                  Trocar
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setActiveTab('overview');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm ${
                activeTab === 'overview' ? 'bg-[#0F172A] text-[#ccff00]' : 'text-slate-700'
              }`}
            >
              📊 Visão Geral
            </button>
            <button
              onClick={() => {
                setActiveTab('agenda');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm ${
                activeTab === 'agenda' ? 'bg-[#0F172A] text-[#ccff00]' : 'text-slate-700'
              }`}
            >
              🎾 Agenda de Reservas
            </button>
            <button
              onClick={() => {
                setActiveTab('members');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm ${
                activeTab === 'members' ? 'bg-[#0F172A] text-[#ccff00]' : 'text-slate-700'
              }`}
            >
              👥 Jogadores do Grupo
            </button>
            {isOwnerOrAdmin && (
              <button
                onClick={() => {
                  setActiveTab('admin_panel');
                  setMobileMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 rounded-xl font-bold text-sm ${
                  activeTab === 'admin_panel' ? 'bg-[#0F172A] text-[#ccff00]' : 'text-slate-700'
                }`}
              >
                🛡️ Administração
              </button>
            )}
            <button
              onClick={() => {
                setActiveTab('historico');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-semibold text-sm ${
                activeTab === 'historico' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700'
              }`}
            >
              📜 Histórico
            </button>
            <button
              onClick={() => {
                setActiveTab('profile');
                setMobileMenuOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl font-semibold text-sm ${
                activeTab === 'profile' ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-700'
              }`}
            >
              👤 Meu Perfil
            </button>

            {/* Manual PDF on Mobile */}
            {onOpenManualPdf && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenManualPdf();
                }}
                className="w-full text-left px-4 py-2.5 rounded-xl font-semibold text-sm text-slate-900 bg-slate-100 flex items-center gap-2 mt-2"
              >
                <BookOpen className="w-4 h-4 text-slate-700" />
                📖 Manual do Usuário (PDF)
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};

