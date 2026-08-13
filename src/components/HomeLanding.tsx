import React from 'react';
import {
  UsersRound,
  PlusCircle,
  LogIn,
  CalendarDays,
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
  session,
  onNavigateTab,
  onLogout,
}) => {
  const isAuth = !!session?.user;

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
        
        {/* MOBILE HERO BANNER (< 768px) - Only the tennis player photograph */}
        <section className="w-full md:hidden overflow-hidden rounded-3xl shadow-lg border border-slate-200/80 mb-6 sm:mb-7 bg-slate-900 relative">
          <div className="w-full h-[260px] sm:h-[320px] relative overflow-hidden">
            <img
              src={heroBannerImg}
              alt="Tenista em quadra de tênis"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              style={{
                objectPosition: '85% center',
                transform: 'scale(1.10) translateX(-5%)',
                transformOrigin: 'center'
              }}
            />
          </div>
        </section>

        {/* DESKTOP HERO BANNER (>= 768px) - Preserved with text, badge, button and image */}
        <section className="hidden md:flex w-full overflow-hidden rounded-3xl shadow-2xl border border-slate-800/80 mb-8 bg-[#0F172A] flex-row items-stretch min-h-[460px] lg:min-h-[500px] xl:min-h-[540px] relative">
          
          {/* DESKTOP IMAGE CONTAINER (Right ~50-54%) */}
          <div className="absolute right-0 top-0 bottom-0 w-[50%] lg:w-[52%] xl:w-[54%] h-full z-0 overflow-hidden bg-slate-900">
            <img
              src={heroBannerImg}
              alt="Tenista em quadra real de tênis"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              style={{
                objectPosition: '90% center',
                transform: 'scale(1.12) translateX(-6%)',
                transformOrigin: 'center'
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

        {/* Como você quer começar? Section */}
        <section className="w-full max-w-[1050px] mb-8">
          <div className="text-center mb-6">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Como você quer começar?
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Escolha uma das opções para acessar o sistema
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
            
            {/* 1. Entrar em um grupo */}
            <button
              type="button"
              onClick={() => onSelectAction('PLAYER_REGISTER')}
              className="w-full bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:border-[#0F172A] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer flex flex-row md:flex-col items-center md:items-start text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-[#ccff00] border border-slate-800 flex items-center justify-center shrink-0 mr-4 md:mr-0 md:mb-4 group-hover:scale-105 transition-transform shadow-xs">
                <UsersRound className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-slate-950 transition-colors">
                    Entrar em um grupo
                  </h3>
                  <ChevronRight className="w-4 h-4 text-slate-400 md:hidden shrink-0" />
                </div>
                <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">
                  Use o código do seu grupo para participar.
                </p>
              </div>
            </button>

            {/* 2. Criar um grupo */}
            <button
              type="button"
              onClick={() => onSelectAction('OWNER_REGISTER')}
              className="w-full bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:border-[#0F172A] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer flex flex-row md:flex-col items-center md:items-start text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-[#ccff00] border border-slate-800 flex items-center justify-center shrink-0 mr-4 md:mr-0 md:mb-4 group-hover:scale-105 transition-transform shadow-xs">
                <PlusCircle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-slate-950 transition-colors">
                    Criar um grupo
                  </h3>
                  <ChevronRight className="w-4 h-4 text-slate-400 md:hidden shrink-0" />
                </div>
                <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">
                  Cadastre seu clube, condomínio ou turma.
                </p>
              </div>
            </button>

            {/* 3. Já tenho uma conta */}
            <button
              type="button"
              onClick={() => onSelectAction('LOGIN')}
              className="w-full bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm hover:border-[#0F172A] hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] transition-all cursor-pointer flex flex-row md:flex-col items-center md:items-start text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-[#ccff00] border border-slate-800 flex items-center justify-center shrink-0 mr-4 md:mr-0 md:mb-4 group-hover:scale-105 transition-transform shadow-xs">
                <LogIn className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-slate-950 transition-colors">
                    Já tenho uma conta
                  </h3>
                  <ChevronRight className="w-4 h-4 text-slate-400 md:hidden shrink-0" />
                </div>
                <p className="text-xs text-slate-600 font-medium mt-1 line-clamp-2 leading-relaxed">
                  Entre para acessar agenda e reservas.
                </p>
              </div>
            </button>

          </div>
        </section>

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

