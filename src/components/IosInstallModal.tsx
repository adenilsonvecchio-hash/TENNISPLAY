import React from 'react';
import { Share, PlusSquare, X, CheckCircle2 } from 'lucide-react';
import logoImg from '../assets/images/realistic_tennis_ball_1786391824933.jpg';

interface IosInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IosInstallModal: React.FC<IosInstallModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 text-slate-900 overflow-hidden">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Fechar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with App Icon */}
        <div className="flex flex-col items-center text-center pt-1 mb-5">
          <div className="w-16 h-16 rounded-2xl bg-[#0D172D] p-1 shadow-md mb-3 flex items-center justify-center border border-slate-700">
            <img
              src="/icons/icon-192x192.png"
              alt="TennisPlay Icon"
              className="w-full h-full object-cover rounded-xl"
              onError={(e) => {
                // fallback to logoImg
                e.currentTarget.src = logoImg;
              }}
            />
          </div>
          <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight">
            Instalar TennisPlay
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Instale no seu iPhone ou iPad para acesso instantâneo em tela cheia.
          </p>
        </div>

        {/* Step-by-step Instructions */}
        <div className="space-y-3 bg-slate-50 rounded-2xl p-4 border border-slate-200/80 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
              <Share className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="text-xs leading-relaxed text-slate-700">
              <span className="font-bold text-slate-900">1. Toque no botão Compartilhar</span> na barra inferior do Safari.
            </div>
          </div>

          <div className="h-px bg-slate-200 w-full" />

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#baff00]/40 text-slate-950 flex items-center justify-center shrink-0 mt-0.5">
              <PlusSquare className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="text-xs leading-relaxed text-slate-700">
              <span className="font-bold text-slate-900">2. Role para baixo e selecione</span> <strong className="text-slate-950">"Adicionar à Tela de Início"</strong>.
            </div>
          </div>

          <div className="h-px bg-slate-200 w-full" />

          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 stroke-[2.4]" />
            </div>
            <div className="text-xs leading-relaxed text-slate-700">
              <span className="font-bold text-slate-900">3. Toque em "Adicionar"</span> no canto superior direito.
            </div>
          </div>
        </div>

        {/* Confirm Button */}
        <button
          type="button"
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#0D172D] text-white hover:bg-slate-800 text-xs sm:text-sm font-extrabold shadow-md transition-all active:scale-[0.98] cursor-pointer text-center"
        >
          Entendi
        </button>

      </div>
    </div>
  );
};
