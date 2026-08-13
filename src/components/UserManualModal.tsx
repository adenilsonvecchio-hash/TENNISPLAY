import React, { useState } from 'react';
import { toast } from '../lib/toast';
import { MANUAL_DATA, generateUserManualPdf } from '../lib/pdfGenerator';
import {
  FileText,
  Download,
  Printer,
  X,
  CheckCircle2,
  Building2,
  ShieldCheck,
  UserCheck,
  Search,
  BookOpen,
  Sparkles,
  HelpCircle,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface UserManualModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserManualModal: React.FC<UserManualModalProps> = ({ isOpen, onClose }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  if (!isOpen) return null;

  const categories = [
    { id: 'ALL', label: 'Todos os Passos', icon: BookOpen },
    { id: 'Criar Grupo', label: 'Criar Grupo', icon: Building2 },
    { id: 'Administrador', label: 'Sou Administrador', icon: ShieldCheck },
    { id: 'Jogador', label: 'Sou Jogador', icon: UserCheck },
  ];

  const filteredSections = MANUAL_DATA.filter((section) => {
    const matchesCategory = selectedCategory === 'ALL' || section.category === selectedCategory;
    const matchesSearch =
      section.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      section.steps.some(
        (st) =>
          st.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          st.detail.toLowerCase().includes(searchTerm.toLowerCase())
      );
    return matchesCategory && matchesSearch;
  });

  const handleDownloadPdf = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        generateUserManualPdf();
        toast.success('Manual baixado com sucesso!');
      } catch (err) {
        console.error('Erro ao gerar PDF:', err);
        toast.error('Erro ao gerar o arquivo PDF. Tente novamente.');
      } finally {
        setIsGenerating(false);
      }
    }, 200);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-md p-3 sm:p-6 overflow-y-auto animate-in fade-in">
      
      {/* Printable Style Sheet Overrides */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-manual, #printable-manual * {
            visibility: visible;
          }
          #printable-manual {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-slate-900 my-auto">
        
        {/* Header Bar */}
        <div className="px-6 py-5 bg-[#0F172A] text-white flex items-center justify-between gap-4 no-print shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#ccff00]/20 text-[#ccff00] border border-[#ccff00]/30 flex items-center justify-center font-bold text-xl">
              📖
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <span>Manual do Usuário & Guia Passo a Passo</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-[#ccff00] text-slate-950">
                  PDF
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Aprenda a cadastrar, criar grupos, gerenciar membros e agendar quadras no TennisPlay.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls Bar */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 no-print shrink-0">
          
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#0F172A] text-[#ccff00] shadow-sm'
                      : 'bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          {/* Action Buttons: PDF Download & Print */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handlePrint}
              className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 font-bold text-xs shadow-xs transition-all cursor-pointer"
              title="Imprimir ou salvar como PDF pelo navegador"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] font-extrabold text-xs shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#ccff00]" />
              <span>{isGenerating ? 'Gerando PDF...' : 'Baixar Manual em PDF'}</span>
            </button>
          </div>
        </div>

        {/* Search Input Bar */}
        <div className="px-6 py-3 bg-white border-b border-slate-100 no-print shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Pesquisar instrução (ex: criar grupo, aprovar membro, agendar simples/duplas)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all"
            />
          </div>
        </div>

        {/* Scrollable Manual Content */}
        <div id="printable-manual" className="p-6 sm:p-8 overflow-y-auto space-y-8 flex-1 bg-white">
          
          {/* Printable Header Notice */}
          <div className="hidden print:block mb-6 border-b-2 border-slate-900 pb-4">
            <h1 className="text-2xl font-black text-slate-900">TennisPlay — Manual do Usuário</h1>
            <p className="text-sm text-slate-600">Guia Passo a Passo: Criar Grupo | Administrador | Jogador</p>
          </div>

          {filteredSections.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-semibold text-sm">Nenhuma instrução encontrada para essa busca.</p>
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); }}
                className="mt-3 text-xs font-bold text-slate-900 hover:underline cursor-pointer"
              >
                Limpar filtros de pesquisa
              </button>
            </div>
          ) : (
            filteredSections.map((sec, secIdx) => (
              <div
                key={secIdx}
                className="bg-slate-50/70 rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5"
              >
                {/* Section Header */}
                <div className="flex items-start justify-between gap-4 border-b border-slate-200/80 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
                      {sec.icon}
                    </span>
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        {sec.title}
                      </h3>
                      <p className="text-xs text-slate-600 mt-0.5 font-medium">
                        {sec.description}
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-700 shrink-0">
                    {sec.category}
                  </span>
                </div>

                {/* Section Steps */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sec.steps.map((st) => (
                    <div
                      key={st.number}
                      className="bg-white rounded-xl p-4 border border-slate-200/90 shadow-2xs hover:border-slate-900 transition-all flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2.5 mb-2">
                          <span className="w-6 h-6 rounded-lg bg-[#0F172A] text-[#ccff00] font-extrabold text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {st.number}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 leading-snug">
                            {st.title}
                          </h4>
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium pl-8">
                          {st.detail}
                        </p>
                      </div>

                      {st.tip && (
                        <div className="mt-3 ml-8 p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-800 font-semibold flex items-start gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>Dica: {st.tip}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}

          {/* Quick Summary Banner */}
          <div className="bg-[#0F172A] rounded-2xl p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 no-print border border-slate-800">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#ccff00]/20 text-[#ccff00] border border-[#ccff00]/30 flex items-center justify-center text-2xl font-bold shrink-0">
                🚀
              </div>
              <div>
                <h4 className="font-bold text-sm sm:text-base">Precisa guardar este manual para consulta rápida?</h4>
                <p className="text-xs text-slate-300">
                  Clique no botão abaixo para baixar o arquivo PDF completo e compartilhar com seus jogadores.
                </p>
              </div>
            </div>

            <button
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="px-5 py-3 rounded-xl bg-[#ccff00] hover:bg-[#b2e600] text-slate-950 font-extrabold text-xs shadow-md transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              Baixar Arquivo PDF
            </button>
          </div>

        </div>

        {/* Footer Bar */}
        <div className="px-6 py-4 bg-slate-100 border-t border-slate-200 text-center no-print text-xs text-slate-500 font-medium shrink-0 flex items-center justify-between">
          <span>🎾 TennisPlay — Guia de Instruções do Usuário</span>
          <button
            onClick={onClose}
            className="text-xs font-bold text-slate-700 hover:text-slate-900 underline"
          >
            Fechar Janela
          </button>
        </div>

      </div>
    </div>
  );
};
