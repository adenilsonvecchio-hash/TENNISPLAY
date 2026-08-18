import React, { useState, useEffect } from 'react';
import {
  UsersRound,
  PlusCircle,
  LogIn,
  Download,
  ChevronRight
} from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { IosInstallModal } from './IosInstallModal';
import manTennisImg from '../assets/images/tennis_man_player_1787084699594.jpg';
import womanTennisImg from '../assets/images/tennis_woman_player_1787084713150.jpg';
import playerFallbackImg from '../assets/images/tennis_player_hd_1786707992007.jpg';
import ballLogoImg from '../assets/images/realistic_tennis_ball_1786391824933.jpg';

interface HomeLandingProps {
  onSelectAction: (action: 'OWNER_REGISTER' | 'ADMIN_LOGIN' | 'PLAYER_REGISTER' | 'LOGIN') => void;
  onOpenSupabaseModal?: () => void;
  onOpenManualPdf?: () => void;
}

export const HomeLanding: React.FC<HomeLandingProps> = ({
  onSelectAction,
}) => {
  const { showInstallButton, triggerInstall } = usePwaInstall();
  const [showIosModal, setShowIosModal] = useState<boolean>(false);
  const [activeSlide, setActiveSlide] = useState<0 | 1>(0);

  // Alternância suave contínua a cada 6 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev === 0 ? 1 : 0));
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const handleInstallClick = async () => {
    const result = await triggerInstall();
    if (result === 'ios') {
      setShowIosModal(true);
    }
  };

  const isThemeOrange = activeSlide === 1;

  return (
    <div
      className={`landing-root-container h-[100svh] max-h-[100svh] w-full overflow-hidden flex flex-col box-border selection:bg-[#C7FF00] selection:text-[#0D172D] transition-colors duration-800 ${
        isThemeOrange ? 'bg-[#F4F3FC]' : 'bg-[#faf9f6]'
      }`}
    >
      {/* 1. CABEÇALHO COMPACTO NO TOPO */}
      <header className="w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shrink-0 h-[52px] sm:h-[58px] md:h-[64px] max-h-[72px] flex items-center z-20 px-4 sm:px-6 lg:px-8">
        <div className="w-full max-w-[1400px] mx-auto flex items-center justify-between gap-3">
          
          {/* Logo TennisPlay Compacto à esquerda */}
          <div className="flex items-center gap-2.5 shrink-0 select-none">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#0D172D] p-0.5 border border-slate-700 shadow-2xs flex items-center justify-center overflow-hidden shrink-0">
              <img
                src={ballLogoImg}
                alt="TennisPlay"
                className="w-full h-full object-cover rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="font-logo font-black text-lg sm:text-xl uppercase tracking-tight leading-none flex items-center">
              <span className="text-[#0D172D]">TENNIS</span>
              <span
                className="text-[#C7FF00]"
                style={{
                  WebkitTextStroke: '1.2px #0D172D',
                  paintOrder: 'stroke fill',
                }}
              >
                PLAY
              </span>
            </div>
          </div>

          {/* Botão Entrar à direita */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectAction('LOGIN')}
              className={`flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl text-[#0D172D] text-xs sm:text-sm font-black shadow-2xs hover:shadow-xs transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap cursor-pointer ${
                isThemeOrange
                  ? 'bg-[#FFAD66] hover:bg-[#FF914D]'
                  : 'bg-[#C7FF00] hover:bg-[#b5ea00]'
              }`}
            >
              <LogIn className="w-4 h-4 text-[#0D172D] shrink-0 stroke-[2.4]" />
              <span>Entrar</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. CONTEÚDO PRINCIPAL (height: calc(100svh - 64px)) */}
      <main className="flex-1 min-h-0 w-full overflow-hidden p-2 sm:p-3 md:p-4 lg:p-6 max-w-[1400px] mx-auto box-border flex flex-col md:grid md:grid-cols-[minmax(0,58%)_minmax(340px,42%)] md:gap-5 lg:gap-8">
        
        {/* LADO ESQUERDO: FOTOGRAFIA EM CARROSSEL COM CROSS-FADE DE 900MS */}
        <section className="hero relative w-full h-[35%] sm:h-[38%] md:h-full min-h-0 rounded-2xl md:rounded-3xl overflow-hidden bg-[#0D172D] border border-slate-200/80 shadow-md shrink-0 md:shrink">
          
          {/* SLIDE 1: HOMEM JOGANDO TÊNIS (Tema 1: Azul-Marinho / Verde-Limão) */}
          <img
            src={manTennisImg}
            alt="Homem jogando tênis"
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            style={{
              opacity: activeSlide === 0 ? 1 : 0,
              zIndex: activeSlide === 0 ? 2 : 1,
              transition: 'opacity 900ms ease-in-out',
              objectPosition: 'center 25%',
            }}
            onError={(e) => {
              e.currentTarget.src = playerFallbackImg;
            }}
          />

          {/* SLIDE 2: MULHER JOGANDO TÊNIS (Tema 2: Laranja / Lilás) */}
          <img
            src={womanTennisImg}
            alt="Mulher jogando tênis"
            referrerPolicy="no-referrer"
            loading="eager"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none"
            style={{
              opacity: activeSlide === 1 ? 1 : 0,
              zIndex: activeSlide === 1 ? 2 : 1,
              transition: 'opacity 900ms ease-in-out',
              objectPosition: 'center 25%',
            }}
            onError={(e) => {
              e.currentTarget.src = playerFallbackImg;
            }}
          />
        </section>

        {/* LADO DIREITO: NOVO PAINEL DE APLICATIVO PREMIUM */}
        <section className="right-column flex-1 md:flex-initial h-[65%] sm:h-[62%] md:h-full min-h-0 flex items-center justify-center overflow-hidden py-1 sm:py-2 px-1 sm:px-3 md:px-4">
          
          {/* CARTÃO CENTRAL ESTILO APLICATIVO */}
          <div
            className={`w-full max-w-[420px] sm:max-w-[440px] max-h-[calc(100svh-80px)] md:max-h-[calc(100svh-110px)] bg-white rounded-[24px] sm:rounded-[30px] shadow-xl md:shadow-2xl border overflow-hidden flex flex-col my-auto transition-all duration-800 ${
              isThemeOrange ? 'border-[#D9D8F2]/80 shadow-[#FF914D]/15' : 'border-slate-200/90 shadow-slate-900/15'
            }`}
          >
            
            {/* CABEÇALHO CURVO ORGÂNICO */}
            <div
              className={`relative text-white pt-3.5 sm:pt-5 md:pt-6 pb-5 sm:pb-7 px-4 sm:px-6 flex flex-col items-center text-center shrink-0 overflow-hidden transition-all duration-800 ${
                isThemeOrange
                  ? 'bg-gradient-to-br from-[#FF914D] via-[#FFA35C] to-[#FFAD66]'
                  : 'bg-[#0D172D]'
              }`}
            >
              
              {/* Linhas decorativas sutis */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" viewBox="0 0 400 200" fill="none">
                <path
                  d="M-20,160 Q120,30 260,110 T440,40"
                  stroke={isThemeOrange ? '#FFFFFF' : '#C7FF00'}
                  strokeWidth="2.5"
                  strokeDasharray="6 6"
                />
                <circle cx="340" cy="55" r="4" fill={isThemeOrange ? '#FFFFFF' : '#C7FF00'} />
              </svg>

              {/* ÍCONE GRANDE DO TENNISPLAY */}
              <div
                className={`relative z-10 w-[64px] h-[64px] sm:w-[80px] sm:h-[80px] md:w-[92px] md:h-[92px] rounded-[18px] sm:rounded-[24px] md:rounded-[28px] p-1.5 sm:p-2 shadow-lg flex items-center justify-center mb-1.5 sm:mb-2.5 shrink-0 transform hover:scale-105 transition-all duration-800 ${
                  isThemeOrange
                    ? 'bg-white shadow-[#FF914D]/30 border border-white/60'
                    : 'bg-[#C7FF00] shadow-[#0D172D]/20'
                }`}
              >
                <svg className="w-full h-full drop-shadow-xs" viewBox="0 0 100 100" fill="none">
                  <circle cx="50" cy="50" r="42" fill="#0D172D" />
                  <path
                    d="M 12 30 C 38 34, 38 66, 12 70"
                    stroke={isThemeOrange ? '#FF914D' : '#C7FF00'}
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                  <path
                    d="M 88 30 C 62 34, 62 66, 88 70"
                    stroke={isThemeOrange ? '#FF914D' : '#C7FF00'}
                    strokeWidth="6"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              {/* NOME DA MARCA */}
              <div className="relative z-10 font-logo font-black text-xl sm:text-2xl md:text-[28px] tracking-tight uppercase leading-none flex items-center justify-center gap-0.5">
                <span className="text-white drop-shadow-xs">TENNIS</span>
                <span
                  className="text-[#C7FF00] drop-shadow-xs"
                  style={{
                    WebkitTextStroke: isThemeOrange ? '1.2px #0D172D' : '0px',
                    paintOrder: 'stroke fill',
                  }}
                >
                  PLAY
                </span>
              </div>

              {/* FRASE INSPIRACIONAL */}
              <p className="relative z-10 text-[11px] sm:text-xs text-white/90 font-medium tracking-wide mt-1 leading-none">
                Seu jogo começa aqui.
              </p>

              {/* CURVA ORGÂNICA EM SVG */}
              <div className="absolute -bottom-1 left-0 right-0 w-full overflow-hidden leading-none pointer-events-none">
                <svg viewBox="0 0 500 40" preserveAspectRatio="none" className="relative block w-full h-[16px] sm:h-[22px] text-white fill-current">
                  <path d="M0,0 C150,38 350,38 500,0 L500,40 L0,40 Z" />
                </svg>
              </div>
            </div>

            {/* CORPO BRANCO DO CARTÃO */}
            <div className="p-3 sm:p-4 md:p-5 flex-1 flex flex-col justify-center overflow-hidden bg-white">
              
              <h2 className="text-center text-xs sm:text-sm md:text-base font-black text-[#0D172D] tracking-tight mb-2 sm:mb-3">
                Comece agora
              </h2>

              <div className="flex flex-col gap-1.5 sm:gap-2.5 w-full">
                
                {/* 1. Entrar em um grupo */}
                <button
                  type="button"
                  onClick={() => onSelectAction('PLAYER_REGISTER')}
                  className={`w-full h-[48px] sm:h-[56px] md:h-[60px] active:scale-[0.99] hover:-translate-y-0.5 transition-all duration-300 rounded-[14px] sm:rounded-[18px] px-3 sm:px-4 border flex items-center justify-between group cursor-pointer ${
                    isThemeOrange
                      ? 'bg-[#EAE9F8] hover:bg-[#dedcf5] border-[#D9D8F2]'
                      : 'bg-[#F5F7FA] hover:bg-[#ebf0f7] border-slate-200/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div
                      className={`w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-all duration-300 ${
                        isThemeOrange
                          ? 'bg-white text-[#FF914D] border border-[#D9D8F2]'
                          : 'bg-[#C7FF00] text-[#0D172D]'
                      }`}
                    >
                      <UsersRound className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-[#0D172D] tracking-tight">
                      Entrar em um grupo
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 transition-all duration-300 group-hover:translate-x-0.5 ${
                      isThemeOrange
                        ? 'text-[#FF914D] group-hover:text-[#0D172D]'
                        : 'text-slate-400 group-hover:text-[#0D172D]'
                    }`}
                  />
                </button>

                {/* 2. Criar um grupo */}
                <button
                  type="button"
                  onClick={() => onSelectAction('OWNER_REGISTER')}
                  className={`w-full h-[48px] sm:h-[56px] md:h-[60px] active:scale-[0.99] hover:-translate-y-0.5 transition-all duration-300 rounded-[14px] sm:rounded-[18px] px-3 sm:px-4 border flex items-center justify-between group cursor-pointer ${
                    isThemeOrange
                      ? 'bg-[#EAE9F8] hover:bg-[#dedcf5] border-[#D9D8F2]'
                      : 'bg-[#F5F7FA] hover:bg-[#ebf0f7] border-slate-200/70'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div
                      className={`w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-all duration-300 ${
                        isThemeOrange
                          ? 'bg-white text-[#FF914D] border border-[#D9D8F2]'
                          : 'bg-[#C7FF00] text-[#0D172D]'
                      }`}
                    >
                      <PlusCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-[#0D172D] tracking-tight">
                      Criar um grupo
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 transition-all duration-300 group-hover:translate-x-0.5 ${
                      isThemeOrange
                        ? 'text-[#FF914D] group-hover:text-[#0D172D]'
                        : 'text-slate-400 group-hover:text-[#0D172D]'
                    }`}
                  />
                </button>

                {/* 3. Já tenho uma conta */}
                <button
                  type="button"
                  onClick={() => onSelectAction('LOGIN')}
                  className={`w-full h-[50px] sm:h-[58px] md:h-[62px] active:scale-[0.99] hover:-translate-y-0.5 transition-all duration-300 rounded-[14px] sm:rounded-[18px] px-3 sm:px-4 flex items-center justify-between group cursor-pointer shadow-md ${
                    isThemeOrange
                      ? 'bg-gradient-to-r from-[#FF914D] to-[#FF8033] hover:from-[#f5833d] hover:to-[#f07424] text-white shadow-[#FF914D]/25'
                      : 'bg-[#0D172D] hover:bg-[#142344] text-white shadow-[#0D172D]/15'
                  }`}
                >
                  <div className="flex items-center gap-2.5 sm:gap-3">
                    <div
                      className={`w-7 h-7 sm:w-8.5 sm:h-8.5 rounded-full flex items-center justify-center shrink-0 group-hover:scale-105 transition-all duration-300 ${
                        isThemeOrange
                          ? 'bg-white/20 text-white'
                          : 'bg-white/10 text-[#C7FF00]'
                      }`}
                    >
                      <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.5]" />
                    </div>
                    <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight">
                      Já tenho uma conta
                    </span>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 transition-all duration-300 group-hover:translate-x-0.5 ${
                      isThemeOrange ? 'text-white' : 'text-[#C7FF00]'
                    }`}
                  />
                </button>

                {/* Botão de Instalar App */}
                {showInstallButton && (
                  <button
                    type="button"
                    onClick={handleInstallClick}
                    className={`w-full py-1 text-[10.5px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                      isThemeOrange
                        ? 'text-[#FF914D] hover:text-[#0D172D]'
                        : 'text-slate-500 hover:text-[#0D172D]'
                    }`}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Instalar aplicativo na tela inicial</span>
                  </button>
                )}

              </div>

            </div>

          </div>

        </section>

      </main>

      {/* MODAL DE INSTRUÇÕES DE INSTALAÇÃO NO IPHONE / IPAD */}
      <IosInstallModal
        isOpen={showIosModal}
        onClose={() => setShowIosModal(false)}
      />

    </div>
  );
};
