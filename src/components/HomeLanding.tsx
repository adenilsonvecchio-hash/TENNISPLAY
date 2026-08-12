import React from 'react';
import {
  ShieldCheck,
  UserRound,
  LogIn,
  CalendarDays,
  MapPinned,
  UsersRound,
  CalendarCheck,
  Bell,
  UserCog,
  CircleHelp,
  PlusCircle,
  Clock,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { AuthSession } from '../types';
import heroBannerImg from '../assets/images/tennis_hero_banner_1786468150505.jpg';

interface HomeLandingProps {
  onSelectAction: (action: 'OWNER_REGISTER' | 'ADMIN_LOGIN' | 'PLAYER_REGISTER' | 'LOGIN') => void;
  onOpenSupabaseModal?: () => void;
  onOpenManualPdf?: () => void;
  session?: AuthSession | null;
  onNavigateTab?: (tab: string) => void;
  onLogout?: () => void;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  onSelectAction,
  onOpenSupabaseModal,
  onOpenManualPdf,
  session,
  onNavigateTab,
  onLogout,
}) => {
  const isAuth = !!session?.user;
  const isAdmin = session?.activeRole === 'PROPRIETARIO' || session?.activeRole === 'ADMINISTRADOR';

  const handleShortcutClick = (id: string) => {
    switch (id) {
      case 'create_group':
        if (isAuth) {
          onNavigateTab?.('overview');
        } else {
          onSelectAction('OWNER_REGISTER');
        }
        break;

      case 'admin':
        if (isAuth) {
          if (isAdmin) {
            onNavigateTab?.('admin_panel');
          } else {
            alert('Acesso restrito a Administradores e Proprietários de grupos.');
          }
        } else {
          onSelectAction('ADMIN_LOGIN');
        }
        break;

      case 'player':
        if (isAuth) {
          onNavigateTab?.('members');
        } else {
          onSelectAction('PLAYER_REGISTER');
        }
        break;

      case 'login':
        if (isAuth) {
          if (onLogout) onLogout();
          else onNavigateTab?.('profile');
        } else {
          onSelectAction('LOGIN');
        }
        break;

      case 'agenda':
        if (isAuth) {
          onNavigateTab?.('agenda');
        } else {
          onSelectAction('LOGIN');
        }
        break;

      case 'quadras':
        if (isAuth) {
          if (isAdmin) {
            onNavigateTab?.('admin_panel');
          } else {
            onNavigateTab?.('agenda');
          }
        } else {
          onSelectAction('LOGIN');
        }
        break;

      case 'jogadores':
        if (isAuth) {
          onNavigateTab?.('members');
        } else {
          onSelectAction('LOGIN');
        }
        break;

      case 'reservas':
        if (isAuth) {
          onNavigateTab?.('historico');
        } else {
          onSelectAction('LOGIN');
        }
        break;

      case 'notificacoes':
        if (isAuth) {
          onNavigateTab?.('overview');
        } else {
          onSelectAction('LOGIN');
        }
        break;

      case 'perfil':
        if (isAuth) {
          onNavigateTab?.('profile');
        } else {
          onSelectAction('LOGIN');
        }
        break;

      case 'ajuda':
        if (onOpenManualPdf) {
          onOpenManualPdf();
        }
        break;

      default:
        break;
    }
  };

  // 10 Shortcuts List definition
  const shortcuts = [
    {
      id: 'create_group',
      label: 'Criar Grupo',
      icon: PlusCircle,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'admin',
      label: 'Administrador',
      icon: ShieldCheck,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'player',
      label: 'Jogador',
      icon: UserRound,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'agenda',
      label: 'Agenda',
      icon: CalendarDays,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'quadras',
      label: 'Quadras',
      icon: MapPinned,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'jogadores',
      label: 'Jogadores',
      icon: UsersRound,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'reservas',
      label: 'Reservas',
      icon: CalendarCheck,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'notificacoes',
      label: 'Notificações',
      icon: Bell,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'perfil',
      label: 'Perfil',
      icon: UserCog,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
    {
      id: 'ajuda',
      label: 'Ajuda',
      icon: CircleHelp,
      bg: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
      activeBg: 'group-hover:bg-[#ccff00] group-hover:text-slate-950',
    },
  ];

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-between text-slate-900 font-sans selection:bg-[#ccff00] selection:text-slate-950">
      {/* Header */}
      <header className="w-full bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center shrink-0">
            <AppLogo size="md" />
          </div>

          <div className="flex items-center gap-2">
            {!isAuth ? (
              <button
                type="button"
                onClick={() => onSelectAction('LOGIN')}
                className="flex items-center gap-1.5 px-4.5 py-2 rounded-2xl bg-[#ccff00] hover:bg-[#b2e600] text-slate-950 text-xs sm:text-sm font-extrabold shadow-md shadow-[#ccff00]/40 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-slate-950 shrink-0" />
                <span>Entrar</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-600 hidden sm:inline">
                  Olá, <strong className="text-slate-900">{session?.user?.nome}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab?.('agenda')}
                  className="px-4 py-2 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
                >
                  Acessar Painel
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-12 flex flex-col items-center justify-start">
        
        {/* Realistic Hero Scene Section */}
        <section className="w-full relative overflow-hidden rounded-3xl min-h-[480px] sm:min-h-[520px] lg:min-h-[560px] flex items-center shadow-2xl border border-slate-800/60 mb-8 bg-[#0F172A]">
          {/* Background Image: Tennis Player on Court */}
          <div className="absolute inset-0 z-0">
            <img
              src={heroBannerImg}
              alt="Tenista em quadra real de tênis"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover object-center lg:object-right"
            />
          </div>

          {/* Smooth Soft Navy Overlay on the left for maximum readability, leaving the tennis player on the right 100% visible */}
          <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#0b1329] via-[#0b1329]/85 sm:via-[#0b1329]/60 to-transparent pointer-events-none" />
          <div className="absolute inset-0 z-10 bg-gradient-to-t from-[#0b1329]/80 via-transparent to-transparent pointer-events-none sm:hidden" />

          {/* Hero Content Container - Left Column for text, Right area clear for the female tennis player */}
          <div className="relative z-20 w-full max-w-[1150px] mx-auto px-6 sm:px-10 py-10 lg:py-14">
            
            {/* Left Clean Text & CTAs */}
            <div className="max-w-xl flex flex-col items-start text-left space-y-5 sm:space-y-6">
              
              {/* Subtle Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ccff00]/15 border border-[#ccff00]/30 backdrop-blur-md">
                <span className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse" />
                <span className="text-[#ccff00] font-extrabold text-xs tracking-wide uppercase">
                  TennisPlay • Sistema Oficial de Quadras
                </span>
              </div>

              {/* Main Requested Title */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.1] drop-shadow-sm">
                Seu próximo jogo <br className="hidden sm:inline" />
                <span className="text-[#ccff00] font-black">começa aqui.</span>
              </h1>

              {/* Requested Text */}
              <p className="text-base sm:text-xl text-slate-200 font-medium leading-relaxed">
                Reserve horários, encontre jogadores da sua classe e entre em quadra.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 w-full sm:w-auto">
                {/* Primary Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (isAuth) {
                      onNavigateTab?.('agenda');
                    } else {
                      onSelectAction('LOGIN');
                    }
                  }}
                  className="flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-[#ccff00] hover:bg-[#b5e600] text-slate-950 font-black text-base shadow-xl shadow-[#ccff00]/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <CalendarDays className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                  <span>Reservar meu horário</span>
                </button>
              </div>

            </div>

          </div>
        </section>

        {/* 10 Shortcuts Grid */}
        <div className="w-full max-w-[1150px]">
          <div className="text-center mb-5">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Acesso Rápido às Funcionalidades
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Escolha uma opção para navegar no sistema
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6 mb-12">
            {shortcuts.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleShortcutClick(item.id)}
                  className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200 hover:border-[#0F172A] hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center justify-center text-center group active:scale-95 select-none min-h-[135px] sm:min-h-[145px]"
                  aria-label={item.label}
                >
                  {/* Centered Icon Container */}
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center border shadow-xs transition-colors duration-200 mb-3 ${item.bg} ${item.activeBg}`}
                  >
                    <Icon className="w-7 h-7 sm:w-8 sm:h-8 transition-transform group-hover:scale-105" />
                  </div>

                  {/* Text Label Below */}
                  <span className="text-slate-900 font-bold text-sm sm:text-base tracking-tight leading-tight group-hover:text-slate-950 transition-colors">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Info / Quick Options for Group Creation */}
        <div className="w-full max-w-[1150px] bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-center md:text-left">
            <span className="px-3 py-1 rounded-full bg-slate-900 text-[#ccff00] text-xs font-bold uppercase tracking-wider inline-block mb-2">
              🎾 Para Clubes & Condomínios
            </span>
            <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
              Quer criar um novo grupo para seu clube ou amigos?
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 mt-1">
              Cadastre sua comunidade e gerencie quadras, solicitações e horários com facilidade.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => onSelectAction('OWNER_REGISTER')}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl bg-[#ccff00] hover:bg-[#b2e600] text-slate-950 font-extrabold text-xs sm:text-sm shadow-md shadow-[#ccff00]/30 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              Criar Novo Grupo
            </button>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="w-full bg-white/80 backdrop-blur-md border-t border-slate-200 py-5">
        <div className="max-w-[1200px] mx-auto px-4 flex items-center justify-center">
          <AppLogo size="sm" />
        </div>
      </footer>
    </div>
  );
};

