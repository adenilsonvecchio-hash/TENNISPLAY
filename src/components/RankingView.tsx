import React, { useState } from 'react';
import { AuthSession, RankingJogador, PlayerClass, DEFAULT_PLAYER_CLASSES } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import { useSwrData, TTL_MAP, invalidateCache } from '../lib/swr';
import {
  Trophy,
  Medal,
  Flame,
  Search,
  Swords,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Users,
  Award,
  ChevronDown
} from 'lucide-react';
import { JogarFlowModal } from './JogarFlowModal';

interface RankingViewProps {
  session: AuthSession;
  onRefreshSession?: () => void;
}

export const RankingView: React.FC<RankingViewProps> = ({ session, onRefreshSession }) => {
  const { user, activeGroup } = session;

  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('TODAS');
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState<number>(20);

  // Jogar flow modal triggered by "Desafiar"
  const [showJogarModal, setShowJogarModal] = useState(false);
  const [opponentToChallenge, setOpponentToChallenge] = useState<string | undefined>(undefined);

  // SWR: Ranking com TTL de 2 minutos e carregamento imediato do cache
  const {
    data: rankingList = [],
    isLoading,
    isRevalidating,
    revalidate
  } = useSwrData<RankingJogador[]>({
    type: 'group_ranking',
    groupId: activeGroup?.id,
    ttl: TTL_MAP.RANKING,
    enabled: !!activeGroup,
    fetcher: () => (activeGroup ? DbService.getGroupRanking(activeGroup.id) : Promise.resolve([]))
  });

  const handleRefresh = async () => {
    if (activeGroup) {
      invalidateCache('group_ranking', undefined, activeGroup.id);
      await revalidate();
    }
  };

  const handleChallengePlayer = (opponentId: string) => {
    setOpponentToChallenge(opponentId);
    setShowJogarModal(true);
  };

  if (!user || !activeGroup) return null;

  // Filtragem
  const filteredRanking = rankingList.filter((item) => {
    const matchesSearch =
      item.usuario.nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.usuario.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesClass =
      selectedClassFilter === 'TODAS' || item.classe === selectedClassFilter;

    return matchesSearch && matchesClass;
  });

  const top3 = rankingList.slice(0, 3);
  const displayedRanking = filteredRanking.slice(0, visibleCount);

  const getPositionBadge = (pos: number) => {
    if (pos === 1) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-400 text-amber-950 font-black text-sm flex items-center justify-center shadow-md">
          🥇
        </div>
      );
    }
    if (pos === 2) {
      return (
        <div className="w-8 h-8 rounded-full bg-slate-300 text-slate-900 font-black text-sm flex items-center justify-center shadow-md">
          🥈
        </div>
      );
    }
    if (pos === 3) {
      return (
        <div className="w-8 h-8 rounded-full bg-amber-700 text-amber-100 font-black text-sm flex items-center justify-center shadow-md">
          🥉
        </div>
      );
    }
    return (
      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-extrabold text-xs flex items-center justify-center">
        #{pos}
      </div>
    );
  };

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-5 animate-in fade-in duration-200">
      
      {/* HEADER CARD */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 sm:p-7 shadow-lg border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 text-[#ccff00] text-xs font-black">
              <Trophy className="w-3.5 h-3.5" />
              <span>Ranking do Grupo</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">{activeGroup.nome}</h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium">
              Pontuação e aproveitamento atualizados automaticamente a cada partida oficial.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRevalidating}
              className="px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRevalidating ? 'animate-spin' : ''}`} />
              <span>Atualizar</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setOpponentToChallenge(undefined);
                setShowJogarModal(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-[#ccff00] hover:bg-[#b8e600] text-slate-950 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Swords className="w-4 h-4" />
              <span>🎾 JOGAR</span>
            </button>
          </div>
        </div>

        {/* TOP 3 PODIUM PREVIEW (SE HOUVER DADOS) */}
        {top3.length > 0 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 mt-6 pt-6 border-t border-slate-800">
            {top3.map((item, idx) => {
              const isFirst = idx === 0;
              return (
                <div
                  key={item.usuario.id}
                  className={`p-3 sm:p-4 rounded-2xl flex flex-col items-center text-center justify-between space-y-2 ${
                    isFirst
                      ? 'bg-gradient-to-b from-amber-500/20 to-slate-800/80 border border-amber-400/40'
                      : 'bg-slate-800/50 border border-slate-700/50'
                  }`}
                >
                  <div className="relative">
                    <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black overflow-hidden border-2 ${
                      isFirst ? 'border-amber-400' : idx === 1 ? 'border-slate-300' : 'border-amber-700'
                    }`}>
                      {item.usuario.foto_url ? (
                        <img
                          src={item.usuario.foto_url}
                          alt={item.usuario.nome}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{item.usuario.nome.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="absolute -bottom-1 -right-1">
                      {getPositionBadge(item.posicao)}
                    </div>
                  </div>
                  <div className="space-y-0.5 w-full">
                    <p className="text-xs sm:text-sm font-black text-white leading-tight break-words text-center px-1">
                      {item.usuario.nome}
                    </p>
                    <span className="text-[10px] font-bold text-slate-400 block">
                      {item.vitorias}V ({item.aproveitamento}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FILTROS E BUSCA */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          
          {/* SEARCH BAR */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar jogador no ranking..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
            />
          </div>

          {/* CLASS FILTER PILLS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedClassFilter('TODAS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                selectedClassFilter === 'TODAS'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              Todas
            </button>
            {DEFAULT_PLAYER_CLASSES.map((cls) => {
              const simple = cls.replace(/^Classe\s+/i, '').replace(/[()º]/g, '').trim();
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedClassFilter(cls)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                    selectedClassFilter === cls
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  {simple}
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* RANKING LIST */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading && rankingList.length === 0 ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-slate-100 rounded-2xl" />
            ))}
          </div>
        ) : filteredRanking.length === 0 ? (
          <div className="py-16 text-center text-slate-400 space-y-2">
            <Users className="w-8 h-8 mx-auto opacity-50" />
            <p className="text-xs font-bold">Nenhum jogador encontrado para os filtros selecionados.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {displayedRanking.map((item) => {
              const isCurrentUser = item.usuario.id === user.id;

              return (
                <div
                  key={item.usuario.id}
                  className={`p-3.5 sm:p-5 flex items-center justify-between gap-2.5 sm:gap-4 transition-colors ${
                    isCurrentUser ? 'bg-amber-50/50 hover:bg-amber-50/80 border-l-4 border-amber-400' : 'hover:bg-slate-50/80'
                  }`}
                >
                  {/* ESQUERDA: Posição + Foto + Dados do Jogador (Nome, Classe, Stats) */}
                  <div className="flex items-center sm:items-start gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                    
                    {/* POSIÇÃO */}
                    <div className="shrink-0 pt-0.5">
                      {getPositionBadge(item.posicao)}
                    </div>

                    {/* FOTO */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-xs">
                      {item.usuario.foto_url ? (
                        <img
                          src={item.usuario.foto_url}
                          alt={item.usuario.nome}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{item.usuario.nome.charAt(0).toUpperCase()}</span>
                      )}
                    </div>

                    {/* BLOCO DE TEXTO: NOME COMPLETO, CLASSE E ESTATÍSTICAS */}
                    <div className="min-w-0 flex-1 space-y-1">
                      
                      {/* LINHA 1: NOME COMPLETO + SELO VOCÊ */}
                      <div className="flex items-center flex-wrap gap-1.5 leading-snug">
                        <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug break-words">
                          {item.usuario.nome}
                        </h3>
                        {isCurrentUser && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md bg-slate-900 text-[#ccff00] shrink-0">
                            Você
                          </span>
                        )}
                      </div>

                      {/* LINHA 2: CLASSE */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          {item.classe}
                        </span>
                      </div>

                      {/* LINHA 3: ESTATÍSTICAS COMPLETAS (No celular inclui aproveitamento) */}
                      <div className="text-[11px] font-medium text-slate-500 leading-tight flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pt-0.5">
                        <span>{item.partidas} {item.partidas === 1 ? 'partida' : 'partidas'}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-semibold text-slate-700">{item.vitorias}V / {item.derrotas}D</span>
                        
                        {/* Aproveitamento visível inline no celular */}
                        <span className="inline-flex sm:hidden items-center gap-1">
                          <span className="text-slate-300">·</span>
                          <span className="font-black text-slate-900">{item.aproveitamento}% aprov.</span>
                        </span>
                      </div>

                    </div>
                  </div>

                  {/* DIREITA: STATS EM COLUNA (Desktop) & BOTÃO DESAFIAR */}
                  <div className="flex items-center gap-3 sm:gap-5 shrink-0 self-center">
                    
                    {/* APROVEITAMENTO (Desktop) */}
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Aproveitamento
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        {item.aproveitamento}%
                      </span>
                    </div>

                    {/* PONTOS (Desktop) */}
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] font-bold uppercase text-slate-400 block">
                        Pontos
                      </span>
                      <span className="text-xs sm:text-sm font-black text-slate-900">
                        {item.pontos} pts
                      </span>
                    </div>

                    {/* BOTÃO DESAFIAR */}
                    {!isCurrentUser && (
                      <button
                        type="button"
                        onClick={() => handleChallengePlayer(item.usuario.id)}
                        className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-[#0F172A] hover:text-[#ccff00] text-slate-800 text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
                        title={`Desafiar ${item.usuario.nome}`}
                      >
                        <Swords className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        <span className="hidden sm:inline">Desafiar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* BOTÃO CARREGAR MAIS SE HOUVER MAIS JOGADORES */}
            {filteredRanking.length > visibleCount && (
              <div className="p-4 text-center bg-slate-50/50 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 20)}
                  className="px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 text-xs font-black border border-slate-200 shadow-2xs transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <ChevronDown className="w-4 h-4" />
                  <span>Ver mais {Math.min(20, filteredRanking.length - visibleCount)} jogadores</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* JOGAR FLOW MODAL */}
      {showJogarModal && (
        <JogarFlowModal
          session={session}
          isOpen={showJogarModal}
          onClose={() => {
            setShowJogarModal(false);
            setOpponentToChallenge(undefined);
          }}
          preSelectedOpponentId={opponentToChallenge}
          onSuccess={() => {
            handleRefresh();
            if (onRefreshSession) onRefreshSession();
          }}
        />
      )}

    </div>
  );
};
