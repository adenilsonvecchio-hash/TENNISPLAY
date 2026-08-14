import React from 'react';
import {
  UsersRound,
  PlusCircle,
  LogIn,
  User,
  CalendarDays,
  ChevronRight
} from 'lucide-react';
import { AppLogo } from './AppLogo';
import { AuthSession } from '../types';
import heroBannerImg from '../assets/images/tennis_player_hd_1786707992007.jpg';

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
  session,
  onNavigateTab,
  onLogout,
}) => {
  const isAuth = !!session?.user;

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col justify-start text-slate-900 font-sans selection:bg-[#ccff00] selection:text-slate-950 overflow-x-hidden md:overflow-visible box-border pb-[82px] md:pb-0">
      {/* Header (Approx 58px) */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 shrink-0 h-[58px] flex items-center">
        <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-2">
          <div className="flex items-center shrink-0">
            <AppLogo size="sm" />
          </div>

          <div className="flex items-center gap-2">
            {!isAuth ? (
              <button
                type="button"
                onClick={() => onSelectAction('LOGIN')}
                className="flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 rounded-2xl bg-[#ccff00] hover:bg-[#b2e600] text-slate-950 text-xs sm:text-sm font-extrabold shadow-sm shadow-[#ccff00]/40 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap cursor-pointer"
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
                  className="px-3.5 py-1.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs sm:text-sm font-bold shadow-sm transition-all cursor-pointer"
                >
                  Acessar Painel
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area - Positioned 12px to 16px below header */}
      <main className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 pt-3.5 pb-4 md:py-8 flex flex-col items-center justify-start min-h-0 flex-1">
        
        {/* MOBILE HERO BANNER (< 768px) - Full tennis player photograph (expanded to utilize available space) */}
        <section className="w-full md:hidden overflow-hidden rounded-2xl shadow-xs border border-slate-200/80 bg-[#0d172b] relative shrink-0">
          <div className="w-full mobile-hero-photo-container relative overflow-hidden bg-[#0d172b] flex items-center justify-center">
            <img
              src={heroBannerImg}
              alt="Tenista em quadra de tênis"
              referrerPolicy="no-referrer"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover"
              style={{
                objectPosition: '75% center',
                imageRendering: 'auto',
              }}
            />
          </div>
        </section>

        {/* MOBILE CENTRAL TITLE ONLY (< 768px) */}
        <div className="w-full text-center mt-3.5 sm:mt-4 mb-2 md:hidden">
          <h2 className="text-[19px] sm:text-[21px] font-black text-slate-900 tracking-tight leading-tight">
            Como você quer começar?
          </h2>
        </div>

        {/* DESKTOP HERO BANNER (>= 768px) - Preserved with text, badge, button and image */}
        <section className="hidden md:flex w-full overflow-hidden rounded-3xl shadow-2xl border border-slate-800/80 mb-8 bg-[#0F172A] flex-row items-stretch min-h-[460px] lg:min-h-[500px] xl:min-h-[540px] relative shrink-0">
          
          {/* DESKTOP IMAGE CONTAINER (Right ~50-54%) */}
          <div className="absolute right-0 top-0 bottom-0 w-[50%] lg:w-[52%] xl:w-[54%] h-full z-0 overflow-hidden bg-slate-900">
            <img
              src={heroBannerImg}
              alt="Tenista em quadra real de tênis"
              referrerPolicy="no-referrer"
              loading="eager"
              decoding="async"
              className="w-full h-full object-cover"
              style={{
                objectPosition: '90% center',
                transform: 'scale(1.12) translateX(-6%)',
                transformOrigin: 'center',
                imageRendering: 'auto',
              }}
            />
            {/* Smooth soft gradient ONLY between text area on left and image on right */}
            <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#0F172A] to-transparent pointer-events-none" />
          </div>

          {/* TEXT CONTENT CONTAINER */}
          <div className="relative z-10 w-[55%] lg:w-[50%] xl:w-[48%] p-8 lg:p-12 xl:p-14 flex flex-col items-start justify-center text-left space-y-5 lg:space-y-6 bg-[#0F172A]">
            
            {/* Subtle Badge */}
            <div className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-[#ccff00]/15 border border-[#ccff00]/30 backdrop-blur-md">
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-[#ccff00] animate-pulse shrink-0" />
              <span className="text-[#ccff00] font-bold text-[10px] sm:text-xs tracking-wider uppercase whitespace-nowrap leading-none text-center">
                Sistema de Quadras
              </span>
            </div>

            {/* Main Requested Title */}
            <h1 className="text-3xl lg:text-5xl xl:text-6xl font-black text-white tracking-tight leading-[1.1] drop-shadow-sm">
              Seu próximo jogo <br />
              <span className="text-[#ccff00] font-black">começa aqui.</span>
            </h1>

            {/* Requested Description Text */}
            <p className="text-sm lg:text-lg text-slate-200 font-medium leading-relaxed">
              Reserve horários, encontre jogadores da sua classe e entre em quadra.
            </p>

            {/* Action Button */}
            <div className="pt-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => {
                  if (isAuth) {
                    onNavigateTab?.('agenda');
                  } else {
                    onSelectAction('LOGIN');
                  }
                }}
                className="w-full lg:w-auto flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-[#ccff00] hover:bg-[#b5e600] text-slate-950 font-black text-base shadow-xl shadow-[#ccff00]/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              >
                <CalendarDays className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                <span>Agendar Horário</span>
              </button>
            </div>

          </div>
        </section>

        {/* DESKTOP Como você quer começar? Section (>= 768px) */}
        <section className="hidden md:flex w-full max-w-[1050px] flex-col justify-start mb-8">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
              Como você quer começar?
            </h2>
            <p className="text-sm text-slate-600 font-medium mt-1">
              Escolha uma das opções para acessar o sistema
            </p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            
            {/* 1. Entrar em um grupo */}
            <button
              type="button"
              onClick={() => onSelectAction('PLAYER_REGISTER')}
              className="w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs hover:border-[#0F172A] hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer flex flex-col items-start text-left group shrink-0"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-[#ccff00] border border-slate-800 flex items-center justify-center shrink-0 mb-4 group-hover:scale-105 transition-transform shadow-2xs">
                <UsersRound className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-slate-950 transition-colors whitespace-normal">
                  Entrar em um grupo
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">
                  Use o código do seu grupo para participar.
                </p>
              </div>
            </button>

            {/* 2. Criar um grupo */}
            <button
              type="button"
              onClick={() => onSelectAction('OWNER_REGISTER')}
              className="w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs hover:border-[#0F172A] hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer flex flex-col items-start text-left group shrink-0"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-[#ccff00] border border-slate-800 flex items-center justify-center shrink-0 mb-4 group-hover:scale-105 transition-transform shadow-2xs">
                <PlusCircle className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-slate-950 transition-colors whitespace-normal">
                  Criar um grupo
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">
                  Cadastre seu clube, condomínio ou turma.
                </p>
              </div>
            </button>

            {/* 3. Já tenho uma conta */}
            <button
              type="button"
              onClick={() => onSelectAction('LOGIN')}
              className="w-full bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs hover:border-[#0F172A] hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer flex flex-col items-start text-left group shrink-0"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-[#ccff00] border border-slate-800 flex items-center justify-center shrink-0 mb-4 group-hover:scale-105 transition-transform shadow-2xs">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-extrabold text-slate-900 group-hover:text-slate-950 transition-colors whitespace-normal">
                  Já tenho uma conta
                </h3>
                <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">
                  Entre para acessar agenda e reservas.
                </p>
              </div>
            </button>

          </div>
        </section>

      </main>

      {/* MOBILE FIXED BOTTOM NAVIGATION BAR (< 768px) */}
      <nav
        aria-label="Navegação rápida"
        className="mobile-bottom-navigation md:hidden bg-[#C8FF00] border-t border-[#0D172B]/15 rounded-t-2xl shadow-[0_-4px_24px_rgba(0,0,0,0.12)] overflow-hidden"
      >
        <div className="grid grid-cols-3 h-[72px] w-full max-w-lg mx-auto">
          
          {/* 1. Entrar no grupo */}
          <button
            type="button"
            onClick={() => onSelectAction('PLAYER_REGISTER')}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#0D172B] hover:bg-[#b8f000] active:bg-[#0D172B] active:text-[#C8FF00] transition-colors duration-150 cursor-pointer select-none px-1"
          >
            <UsersRound className="w-5 h-5 shrink-0 stroke-[2.4]" />
            <span className="text-[11px] font-extrabold tracking-tight text-center leading-none whitespace-nowrap">
              Entrar no grupo
            </span>
          </button>

          {/* 2. Criar grupo */}
          <button
            type="button"
            onClick={() => onSelectAction('OWNER_REGISTER')}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#0D172B] hover:bg-[#b8f000] active:bg-[#0D172B] active:text-[#C8FF00] transition-colors duration-150 cursor-pointer select-none px-1 border-x border-[#0D172B]/10"
          >
            <PlusCircle className="w-5 h-5 shrink-0 stroke-[2.4]" />
            <span className="text-[11px] font-extrabold tracking-tight text-center leading-none whitespace-nowrap">
              Criar grupo
            </span>
          </button>

          {/* 3. Minha conta */}
          <button
            type="button"
            onClick={() => {
              if (isAuth) {
                onNavigateTab?.('perfil');
              } else {
                onSelectAction('LOGIN');
              }
            }}
            className="w-full h-full flex flex-col items-center justify-center gap-1 text-[#0D172B] hover:bg-[#b8f000] active:bg-[#0D172B] active:text-[#C8FF00] transition-colors duration-150 cursor-pointer select-none px-1"
          >
            <User className="w-5 h-5 shrink-0 stroke-[2.4]" />
            <span className="text-[11px] font-extrabold tracking-tight text-center leading-none whitespace-nowrap">
              Minha conta
            </span>
          </button>

        </div>
      </nav>

      {/* Footer (Hidden on Mobile, Visible on Desktop) */}
      <footer className="hidden md:flex w-full bg-white/80 backdrop-blur-md border-t border-slate-200 py-5">
        <div className="max-w-[1200px] mx-auto px-4 flex items-center justify-center">
          <AppLogo size="sm" />
        </div>
      </footer>
    </div>
  );
};

