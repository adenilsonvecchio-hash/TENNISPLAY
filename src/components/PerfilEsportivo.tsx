import React, { useState, useEffect, useRef } from 'react';
import { AuthSession, EstatisticasJogador, Partida, FeedItem, PlayerClass, RankingJogador, ConfrontoDireto } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import { formatLocation } from '../lib/location';
import { validateAvatarFile, formatAvatarUrlWithCacheBust } from '../lib/avatarImage';
import { formatBrDate, formatCivilDate } from '../lib/dateUtils';
import { LocalCache } from '../lib/cache';
import { invalidateCache } from '../lib/swr';
import {
  Trophy,
  Camera,
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  Flame,
  Award,
  Heart,
  Eye,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Edit3,
  User,
  Swords,
  ChevronRight,
  BarChart3,
  Share2,
  KeyRound,
  ShieldCheck,
  Zap,
  Users,
  Search,
  ArrowRightLeft
} from 'lucide-react';
import { InformarResultadoModal } from './InformarResultadoModal';
import { ConfirmarResultadoModal } from './ConfirmarResultadoModal';
import { DetalhesPartidaModal } from './DetalhesPartidaModal';
import { JogarFlowModal } from './JogarFlowModal';
import { DesafiosRecebidosCard } from './DesafiosRecebidosCard';

interface PerfilEsportivoProps {
  session: AuthSession;
  onRefreshSession: () => void;
}

export const PerfilEsportivo: React.FC<PerfilEsportivoProps> = ({ session, onRefreshSession }) => {
  const { user, activeGroup } = session;
  const currentMember = session.membros.find((m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id);
  const playerClass: PlayerClass = currentMember?.classe || 'Sem Classe';

  // Navigation tab
  const [activeTab, setActiveTab] = useState<'ESTATISTICAS' | 'PARTIDAS' | 'FEED'>('ESTATISTICAS');
  const [matchTab, setMatchTab] = useState<'PROXIMAS' | 'HISTORICO'>('PROXIMAS');

  // Stats & Matches & Feed
  const [stats, setStats] = useState<EstatisticasJogador | null>(() => {
    if (user && activeGroup) {
      const cached = LocalCache.get<EstatisticasJogador>('statistics', user.id, activeGroup.id);
      return cached?.data || null;
    }
    return null;
  });
  const [matches, setMatches] = useState<Partida[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [rankingPos, setRankingPos] = useState<number | null>(null);
  const [groupRanking, setGroupRanking] = useState<RankingJogador[]>([]);

  // Head-to-Head (Confronto Direto)
  const [confrontoAdversarioId, setConfrontoAdversarioId] = useState<string>('');
  const [confrontoData, setConfrontoData] = useState<ConfrontoDireto | null>(null);
  const [loadingConfronto, setLoadingConfronto] = useState<boolean>(false);
  const [searchOpponentQuery, setSearchOpponentQuery] = useState<string>('');

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string | null>(
    user?.foto_url ? formatAvatarUrlWithCacheBust(user.foto_url) : null
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Modals
  const [selectedMatchForDetails, setSelectedMatchForDetails] = useState<Partida | null>(null);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<Partida | null>(null);
  const [selectedMatchForConfirm, setSelectedMatchForConfirm] = useState<Partida | null>(null);
  const [showJogarModal, setShowJogarModal] = useState(false);
  const [opponentToChallenge, setOpponentToChallenge] = useState<string | undefined>(undefined);

  // Edit Profile / Password Modal
  const [showPassModal, setShowPassModal] = useState(false);
  const [passAtual, setPassAtual] = useState('');
  const [novaPass, setNovaPass] = useState('');
  const [confirmNovaPass, setConfirmNovaPass] = useState('');
  const [passFeedback, setPassFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isEditingData, setIsEditingData] = useState(false);
  const [editNome, setEditNome] = useState(user?.nome || '');
  const [editPhone, setEditPhone] = useState(user?.whatsapp || '');

  const loadData = async (forceInvalidate = false) => {
    if (!user || !activeGroup) return;

    if (forceInvalidate) {
      invalidateCache('statistics', user.id, activeGroup.id);
      invalidateCache('matches', user.id, activeGroup.id);
      invalidateCache('group_ranking', undefined, activeGroup.id);
      invalidateCache('group_feed', undefined, activeGroup.id);
    }

    try {
      const [statsData, matchesData, feedData, rankingData] = await Promise.all([
        DbService.getPlayerStatistics(user.id, activeGroup.id),
        DbService.getMatchesForUser(user.id, activeGroup.id),
        DbService.getGroupFeed(activeGroup.id, user.id),
        DbService.getGroupRanking(activeGroup.id).catch(() => [])
      ]);

      setStats(statsData);
      LocalCache.set('statistics', statsData, user.id, activeGroup.id);

      setMatches(matchesData);
      LocalCache.set('matches', matchesData, user.id, activeGroup.id);

      setFeedItems(feedData);
      setGroupRanking(rankingData);

      const userRank = rankingData.find((r) => r.usuario.id === user.id);
      if (userRank) setRankingPos(userRank.posicao);

      // Atualizar confronto direto se houver um adversário selecionado
      if (confrontoAdversarioId) {
        handleSelectOpponentForComparison(confrontoAdversarioId, false);
      }
    } catch (err: any) {
      console.error('Erro ao carregar perfil esportivo:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleSelectOpponentForComparison = async (opponentId: string, showSpinner = true) => {
    if (!user || !activeGroup || !opponentId) {
      setConfrontoAdversarioId('');
      setConfrontoData(null);
      return;
    }

    setConfrontoAdversarioId(opponentId);
    if (showSpinner) setLoadingConfronto(true);

    try {
      const h2h = await DbService.getHeadToHead(user.id, opponentId, activeGroup.id);
      setConfrontoData(h2h);
    } catch (err: any) {
      console.error('Erro ao carregar confronto direto:', err);
      toast.error('Não foi possível carregar o confronto direto com este adversário.');
    } finally {
      if (showSpinner) setLoadingConfronto(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, activeGroup?.id]);

  useEffect(() => {
    setEditNome(user?.nome || '');
    setEditPhone(user?.whatsapp || '');
    if (user?.foto_url) {
      setAvatarDisplayUrl(formatAvatarUrlWithCacheBust(user.foto_url));
    } else {
      setAvatarDisplayUrl(null);
    }
  }, [user]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData(true);
    onRefreshSession();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // 1. Validação prévia de formato e tamanho (máx 5MB)
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      toast.error(validation.error || 'Arquivo de imagem inválido.');
      if (avatarInputRef.current) avatarInputRef.current.value = '';
      return;
    }

    setUploadingAvatar(true);
    try {
      // 2. Upload para o bucket 'avatars' no caminho ${user.id}/avatar.webp
      const { publicUrl } = await DbService.uploadUserAvatar(file, user.id);

      // 3. Atualizar no banco a coluna avatar_url na tabela usuarios
      await DbService.updateUserProfile(user.id, { foto_url: publicUrl });

      // 4. Atualizar imediatamente o estado React com cache-busting
      const timestampedUrl = `${publicUrl}?v=${Date.now()}`;
      setAvatarDisplayUrl(timestampedUrl);
      if (user) {
        user.foto_url = timestampedUrl;
      }

      toast.success('Foto de perfil atualizada com sucesso!');
      onRefreshSession();
    } catch (err: any) {
      console.error('Erro ao atualizar foto de perfil:', err);
      toast.error(err.message || 'Erro ao enviar foto de perfil.');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleSaveData = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await DbService.updateUserProfile(user.id, {
        nome: editNome.trim(),
        whatsapp: editPhone.trim()
      });
      toast.success('Dados pessoais atualizados!');
      setIsEditingData(false);
      onRefreshSession();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar dados.');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaPass.length < 6) {
      setPassFeedback({ type: 'error', message: 'A nova senha deve ter no mínimo 6 caracteres.' });
      return;
    }
    if (novaPass !== confirmNovaPass) {
      setPassFeedback({ type: 'error', message: 'A confirmação da nova senha não confere.' });
      return;
    }

    try {
      await DbService.changeUserPassword(user!.id, passAtual, novaPass);
      setPassFeedback({ type: 'success', message: 'Senha alterada com sucesso!' });
      setTimeout(() => {
        setShowPassModal(false);
        setPassAtual('');
        setNovaPass('');
        setConfirmNovaPass('');
        setPassFeedback(null);
      }, 1500);
    } catch (err: any) {
      setPassFeedback({ type: 'error', message: err.message || 'Erro ao alterar senha.' });
    }
  };

  const handleToggleFeedLike = async (matchId: string) => {
    if (!user) return;
    try {
      const { liked, count } = await DbService.toggleFeedLike(matchId, user.id);
      setFeedItems((prev) =>
        prev.map((item) =>
          item.partida.id === matchId
            ? { ...item, curtidoPeloUsuario: liked, curtidas: count }
            : item
        )
      );
    } catch (err) {
      console.error('Erro ao curtir:', err);
    }
  };

  const handleAcceptChallenge = async (matchId: string) => {
    if (!user) return;
    try {
      await DbService.acceptChallenge(matchId, user.id);
      toast.success('Desafio aceito! O jogo está confirmado na sua agenda. 🎾');
      await loadData();
      onRefreshSession();
    } catch (err: any) {
      console.error('Erro ao aceitar desafio:', err);
      toast.error(err.message || 'Erro ao aceitar desafio.');
    }
  };

  const handleRejectChallenge = async (matchId: string, motivo?: string) => {
    if (!user) return;
    try {
      await DbService.rejectChallenge(matchId, user.id, motivo);
      toast.success('Desafio recusado. A quadra e o horário foram liberados.');
      await loadData();
      onRefreshSession();
    } catch (err: any) {
      console.error('Erro ao recusar desafio:', err);
      toast.error(err.message || 'Erro ao recusar desafio.');
    }
  };

  if (!user || !activeGroup) return null;

  // Desafios pendentes onde o usuário logado é o desafiado (jogador 2)
  const pendingChallenges = matches.filter(
    (m) => m.jogador_2_id === user.id && m.status === 'AGUARDANDO_ACEITE'
  );

  // Helper para ordenação cronológica das partidas
  const getMatchSortDateTime = (m: Partida): string => {
    const dateStr = m.reserva?.data || (m.criado_em ? formatCivilDate(m.criado_em) : '9999-12-31');
    const timeStr = m.reserva?.horario_label ? m.reserva.horario_label.slice(0, 5) : '00:00';
    return `${dateStr} ${timeStr}`;
  };

  // 1. ABA PRÓXIMAS PARTIDAS (Status ACEITA / CONFIRMADA / AGUARDANDO_RESULTADO / AGUARDANDO_CONFIRMACAO_RESULTADO / REALIZADA)
  // Ordenadas da partida mais próxima para a mais distante (cronológica crescente)
  const proximasPartidas = matches
    .filter((m) => ['ACEITA', 'CONFIRMADA', 'REALIZADA', 'AGUARDANDO_RESULTADO', 'AGUARDANDO_CONFIRMACAO_RESULTADO'].includes(m.status))
    .sort((a, b) => getMatchSortDateTime(a).localeCompare(getMatchSortDateTime(b)));

  // 2. ABA HISTÓRICO (Status CONCLUIDA / FINALIZADA)
  // Ordenadas da partida mais recente para a mais antiga (cronológica decrescente)
  const historicoPartidas = matches
    .filter((m) => ['CONCLUIDA', 'FINALIZADA'].includes(m.status))
    .sort((a, b) => {
      const dateA = a.finalizado_em || a.reserva?.data || a.criado_em || '';
      const dateB = b.finalizado_em || b.reserva?.data || b.criado_em || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  // Função para formatar os sets na perspectiva do usuário logado (inversão se for jogador_2)
  const getFormattedSetsForUser = (m: Partida) => {
    const isJ1 = m.jogador_1_id === user.id;

    if (m.sets && m.sets.length > 0) {
      return m.sets
        .slice()
        .sort((a, b) => a.numero_set - b.numero_set)
        .map((s) => {
          const myGames = isJ1 ? s.jogador_1_games : s.jogador_2_games;
          const oppGames = isJ1 ? s.jogador_2_games : s.jogador_1_games;
          return {
            numero: s.numero_set,
            myGames,
            oppGames,
            label: `${myGames} × ${oppGames}`
          };
        });
    }

    if (m.detalhes_placar) {
      const raw = m.detalhes_placar.trim();
      if (raw.toUpperCase().includes('W.O.') || raw.toUpperCase().includes('WO')) {
        return [{ numero: 1, myGames: 0, oppGames: 0, label: 'W.O.' }];
      }

      const chunks = raw.split(/[,;\n]+/).map((c) => c.trim()).filter(Boolean);
      if (chunks.length > 0) {
        return chunks.map((chunk, idx) => {
          const match = chunk.match(/(\d+)\s*[/xX×\-–—]\s*(\d+)/);
          if (match) {
            const g1 = parseInt(match[1], 10);
            const g2 = parseInt(match[2], 10);
            const myGames = isJ1 ? g1 : g2;
            const oppGames = isJ1 ? g2 : g1;
            return {
              numero: idx + 1,
              myGames,
              oppGames,
              label: `${myGames} × ${oppGames}`
            };
          }
          return {
            numero: idx + 1,
            myGames: 0,
            oppGames: 0,
            label: chunk
          };
        });
      }
    }

    return [];
  };

  const formattedLocation = formatLocation(activeGroup.cidade, activeGroup.estado);

  return (
    <div className="w-full max-w-[1100px] mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* ======================================================== */}
      {/* 1. CABEÇALHO DO PERFIL ESPORTIVO */}
      {/* ======================================================== */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 border border-slate-200 shadow-2xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-5">
          
          {/* FOTO E INFORMAÇÕES PESSOAIS */}
          <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 text-center sm:text-left">
            
            {/* AVATAR COM BOTÃO DE UPLOAD */}
            <div className="relative group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900 text-white flex items-center justify-center font-black text-3xl overflow-hidden border-4 border-slate-100 shadow-md">
                {(avatarDisplayUrl || user.foto_url) ? (
                  <img
                    src={(avatarDisplayUrl || user.foto_url)!}
                    alt={user.nome}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span>{user.nome.charAt(0).toUpperCase()}</span>
                )}
              </div>

              {/* Botão de câmera sobre o avatar */}
              <label
                title="Alterar foto de perfil"
                className="absolute -bottom-1 -right-1 w-9 h-9 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] flex items-center justify-center cursor-pointer shadow-lg transition-transform group-hover:scale-105"
              >
                {uploadingAvatar ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                  className="hidden"
                />
              </label>
            </div>

            {/* NOME, CLASSE E LOCALIZAÇÃO */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {user.nome}
                </h1>
                {rankingPos && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-900 border border-amber-200">
                    <Trophy className="w-3 h-3 text-amber-700" />
                    <span>#{rankingPos} no Ranking</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-0.5">
                <span className="inline-block px-3 py-1 rounded-xl text-xs font-black bg-slate-900 text-white shadow-2xs">
                  {playerClass}
                </span>
                {formattedLocation && (
                  <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {formattedLocation}
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 font-medium pt-1">
                Clube: <span className="text-slate-700 font-bold">{activeGroup.nome}</span>
              </p>
            </div>

          </div>

          {/* BOTÕES DE AÇÃO RÁPIDA (JOGAR / EDITAR) */}
          <div className="flex items-center gap-2 self-stretch sm:self-start justify-center">
            <button
              type="button"
              onClick={() => setIsEditingData(!isEditingData)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Editar Dados</span>
            </button>
            <button
              type="button"
              onClick={() => setShowPassModal(true)}
              className="px-3.5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Senha</span>
            </button>
            <button
              type="button"
              onClick={() => setShowJogarModal(true)}
              className="px-5 py-2.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Swords className="w-4 h-4" />
              <span>🎾 JOGAR</span>
            </button>
          </div>

        </div>

        {/* FORMULÁRIO RÁPIDO DE EDIÇÃO DE DADOS */}
        {isEditingData && (
          <form onSubmit={handleSaveData} className="mt-5 pt-5 border-t border-slate-100 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-black uppercase text-slate-400 block mb-1">
                  WhatsApp
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsEditingData(false)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-[#0F172A] text-[#ccff00] text-xs font-black"
              >
                Salvar Alterações
              </button>
            </div>
          </form>
        )}

        {/* 4 CARDS DE MÉTRICAS PRINCIPAIS (HIGHLIGHTS) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-6 pt-6 border-t border-slate-100">
          
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-center">
            <span className="text-[10px] font-extrabold uppercase text-slate-400 block tracking-wider">
              Partidas
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {stats?.totalPartidas || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-center">
            <span className="text-[10px] font-extrabold uppercase text-emerald-700 block tracking-wider">
              Vitórias
            </span>
            <span className="text-xl sm:text-2xl font-black text-emerald-900">
              {stats?.vitorias || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-center">
            <span className="text-[10px] font-extrabold uppercase text-rose-700 block tracking-wider">
              Derrotas
            </span>
            <span className="text-xl sm:text-2xl font-black text-rose-900">
              {stats?.derrotas || 0}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#0F172A] text-white text-center shadow-xs">
            <span className="text-[10px] font-extrabold uppercase text-[#ccff00] block tracking-wider">
              Aproveitamento
            </span>
            <span className="text-xl sm:text-2xl font-black text-white">
              {stats?.aproveitamento || 0}%
            </span>
          </div>

        </div>

      </div>

      {/* ======================================================== */}
      {/* 2. ABAS DE NAVEGAÇÃO DO PERFIL ESPORTIVO */}
      {/* ======================================================== */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('ESTATISTICAS')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'ESTATISTICAS'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Estatísticas Detalhadas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PARTIDAS')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'PARTIDAS'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>Minhas Partidas ({matches.length})</span>
          {pendingChallenges.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[10px] font-black animate-pulse">
              {pendingChallenges.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('FEED')}
          className={`px-4 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'FEED'
              ? 'bg-slate-900 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>Feed de Fotos</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* 3. CONTEÚDO DA ABA SELECIONADA */}
      {/* ======================================================== */}

      {/* ---------------- ABA 1: ESTATÍSTICAS ---------------- */}
      {activeTab === 'ESTATISTICAS' && stats && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* DESAFIOS RECEBIDOS PENDENTES DE ACEITE */}
          {pendingChallenges.length > 0 && (
            <DesafiosRecebidosCard
              challenges={pendingChallenges}
              currentUserId={user.id}
              onAccept={handleAcceptChallenge}
              onReject={handleRejectChallenge}
            />
          )}

          {/* CARDS DE PERFORMANCE TÉCNICA */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* SETS */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400">Sets</span>
                <span className="text-xs font-extrabold text-slate-700">
                  {stats.setsVencidos + stats.setsPerdidos} jogados
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 p-3 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 block">Vencidos</span>
                  <span className="text-xl font-black text-emerald-900">{stats.setsVencidos}</span>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-center">
                  <span className="text-[10px] font-bold text-rose-700 block">Perdidos</span>
                  <span className="text-xl font-black text-rose-900">{stats.setsPerdidos}</span>
                </div>
              </div>
            </div>

            {/* GAMES & SALDO */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400">Games</span>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                  stats.saldoGames >= 0 ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                }`}>
                  Saldo: {stats.saldoGames >= 0 ? `+${stats.saldoGames}` : stats.saldoGames}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">Ganhos</span>
                  <span className="text-xl font-black text-slate-900">{stats.gamesVencidos}</span>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">Cedidos</span>
                  <span className="text-xl font-black text-slate-900">{stats.gamesPerdidos}</span>
                </div>
              </div>
            </div>

            {/* SEQUÊNCIAS & MOMENTUM */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-400">Sequências</span>
                <Flame className="w-4 h-4 text-amber-500" />
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 p-3 rounded-2xl bg-amber-50 border border-amber-200/80 text-center">
                  <span className="text-[10px] font-bold text-amber-800 block">Atual</span>
                  <span className="text-xl font-black text-amber-950">
                    {stats.sequenciaAtual} {stats.sequenciaAtual === 1 ? 'vitória' : 'vitórias'}
                  </span>
                </div>
                <div className="flex-1 p-3 rounded-2xl bg-amber-100/70 border border-amber-300/80 text-center">
                  <span className="text-[10px] font-bold text-amber-900 block">Recorde</span>
                  <span className="text-xl font-black text-amber-950">
                    {stats.maiorSequenciaVitorias} {stats.maiorSequenciaVitorias === 1 ? 'vitória' : 'vitórias'}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* DESEMPENHO POR CLASSE DE ADVERSÁRIO */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Desempenho por Classe de Adversário</h3>
                <p className="text-xs text-slate-500 font-medium">Histórico de confrontos contra cada categoria</p>
              </div>
              <Award className="w-5 h-5 text-slate-400" />
            </div>

            {stats.porClasse.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs font-bold">
                Nenhum confronto finalizado registrado ainda.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {stats.porClasse.map((c) => (
                  <div
                    key={c.classe}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900">{c.classe}</span>
                      <span className="text-xs font-black text-slate-700">{c.aproveitamento}%</span>
                    </div>

                    {/* Barra de progresso visual */}
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden flex">
                      <div
                        className="bg-emerald-500 h-full"
                        style={{ width: `${c.aproveitamento}%` }}
                      />
                      <div
                        className="bg-rose-400 h-full"
                        style={{ width: `${100 - c.aproveitamento}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                      <span>{c.vitorias}V / {c.derrotas}D</span>
                      <span>{c.total} {c.total === 1 ? 'partida' : 'partidas'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* GRÁFICO ANUAL DE BARRAS SVG POR MÊS */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">Histórico de Jogos no Ano</h3>
                <p className="text-xs text-slate-500 font-medium">Distribuição mensal de vitórias e derrotas</p>
              </div>
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1 text-emerald-700">
                  <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
                  Vitórias
                </span>
                <span className="flex items-center gap-1 text-rose-700">
                  <div className="w-2.5 h-2.5 rounded bg-rose-400" />
                  Derrotas
                </span>
              </div>
            </div>

            <div className="pt-4 pb-2">
              <div className="grid grid-cols-12 gap-1 sm:gap-2 items-end h-36 border-b border-slate-200 pb-2">
                {stats.desempenhoAnual.map((m) => {
                  const maxVal = Math.max(...stats.desempenhoAnual.map((d) => d.total), 5);
                  const vHeight = (m.vitorias / maxVal) * 100;
                  const dHeight = (m.derrotas / maxVal) * 100;

                  return (
                    <div key={m.mes} className="flex flex-col items-center gap-1 h-full justify-end group">
                      <div className="w-full max-w-[24px] flex flex-col justify-end gap-0.5 h-full">
                        {m.total > 0 && (
                          <>
                            {m.vitorias > 0 && (
                              <div
                                style={{ height: `${Math.max(vHeight, 8)}%` }}
                                title={`${m.mes}: ${m.vitorias} Vitórias`}
                                className="w-full bg-emerald-500 rounded-t-sm transition-all group-hover:bg-emerald-600"
                              />
                            )}
                            {m.derrotas > 0 && (
                              <div
                                style={{ height: `${Math.max(dHeight, 8)}%` }}
                                title={`${m.mes}: ${m.derrotas} Derrotas`}
                                className="w-full bg-rose-400 rounded-b-sm transition-all group-hover:bg-rose-500"
                              />
                            )}
                          </>
                        )}
                        {m.total === 0 && (
                          <div className="w-full h-1 bg-slate-200 rounded-full" />
                        )}
                      </div>
                      <span className="text-[10px] font-black text-slate-500 tracking-tighter">
                        {m.mes}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* COMPARAÇÃO DIRETA ENTRE JOGADORES (HEAD TO HEAD) */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-slate-900">Comparação Direta (Head to Head)</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                    Histórico & Métricas
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Compare seu retrospecto de vitórias, sets e games contra qualquer jogador do clube
                </p>
              </div>

              {/* SELETOR DE ADVERSÁRIO */}
              <div className="relative min-w-[240px]">
                <select
                  value={confrontoAdversarioId}
                  onChange={(e) => handleSelectOpponentForComparison(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer appearance-none pr-9"
                >
                  <option value="">Selecione um adversário para comparar...</option>
                  {groupRanking
                    .filter((r) => r.usuario.id !== user.id)
                    .map((r) => (
                      <option key={r.usuario.id} value={r.usuario.id}>
                        {r.usuario.nome} ({r.classe || 'Sem Classe'} - #{r.posicao})
                      </option>
                    ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </div>
              </div>
            </div>

            {/* CONTEÚDO DO CONFRONTO DIRETO */}
            {loadingConfronto ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-slate-600" />
                <span className="text-xs font-bold">Calculando retrospecto do confronto direto...</span>
              </div>
            ) : !confrontoAdversarioId ? (
              <div className="p-8 rounded-2xl bg-slate-50/70 border border-dashed border-slate-200 text-center space-y-2">
                <div className="w-10 h-10 mx-auto rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-500 shadow-2xs">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <p className="text-xs font-black text-slate-700">Selecione um jogador acima para visualizar o confronto direto</p>
                <p className="text-[11px] text-slate-400 font-medium">
                  Veja vitórias mútuas, aproveitamento, sets vencidos/perdidos, saldo de games e histórico completo de partidas.
                </p>
              </div>
            ) : confrontoData ? (
              <div className="space-y-5 animate-in fade-in">
                
                {/* CABEÇALHO VISUAL: USUÁRIO vs ADVERSÁRIO */}
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                  
                  {/* JOGADOR 1 (USUÁRIO) */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 justify-center sm:justify-start">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-white/20 flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-xs">
                      {avatarDisplayUrl || user.foto_url ? (
                        <img src={(avatarDisplayUrl || user.foto_url)!} alt={user.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{user.nome.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 text-center sm:text-left">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Você</span>
                      <h4 className="text-sm font-black truncate">{user.nome}</h4>
                      <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-md bg-white/10 text-slate-200 mt-0.5">
                        {playerClass}
                      </span>
                    </div>
                  </div>

                  {/* PLACAR GERAL DE CONFRONTOS */}
                  <div className="flex flex-col items-center justify-center px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-center shrink-0">
                    <span className="text-[10px] font-black uppercase text-[#ccff00] tracking-wider">
                      Vitórias no Confronto
                    </span>
                    <div className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                      <span className={confrontoData.vitoriasUsuario > confrontoData.vitoriasAdversario ? 'text-[#ccff00]' : 'text-white'}>
                        {confrontoData.vitoriasUsuario}
                      </span>
                      <span className="text-slate-400 text-lg">×</span>
                      <span className={confrontoData.vitoriasAdversario > confrontoData.vitoriasUsuario ? 'text-[#ccff00]' : 'text-white'}>
                        {confrontoData.vitoriasAdversario}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-300 font-bold">
                      {confrontoData.totalPartidas} {confrontoData.totalPartidas === 1 ? 'jogo disputado' : 'jogos disputados'}
                    </span>
                  </div>

                  {/* JOGADOR 2 (ADVERSÁRIO) */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 justify-center sm:justify-end flex-row-reverse sm:flex-row">
                    <div className="min-w-0 text-center sm:text-right">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Adversário</span>
                      <h4 className="text-sm font-black truncate">{confrontoData.adversario.nome}</h4>
                      <span className="inline-block text-[10px] font-black px-2 py-0.5 rounded-md bg-white/10 text-slate-200 mt-0.5">
                        {confrontoData.adversarioClasse || 'Sem Classe'}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-slate-800 border-2 border-white/20 flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-xs">
                      {confrontoData.adversario.foto_url ? (
                        <img src={confrontoData.adversario.foto_url} alt={confrontoData.adversario.nome} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <span>{confrontoData.adversario.nome.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                  </div>

                </div>

                {/* BARRA COMPARATIVA DE APROVEITAMENTO */}
                {confrontoData.totalPartidas > 0 && (
                  <div className="space-y-1.5 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs font-black">
                      <span className="text-emerald-700">{confrontoData.aproveitamentoUsuario}% Aproveitamento</span>
                      <span className="text-slate-500 font-bold uppercase text-[10px]">Taxa de Vitória</span>
                      <span className="text-rose-700">{confrontoData.aproveitamentoAdversario}% Aproveitamento</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden flex shadow-inner">
                      <div
                        className="bg-emerald-500 h-full transition-all"
                        style={{ width: `${confrontoData.aproveitamentoUsuario}%` }}
                      />
                      <div
                        className="bg-rose-400 h-full transition-all"
                        style={{ width: `${confrontoData.aproveitamentoAdversario}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* MÉTRICAS DETALHADAS DE SETS E GAMES */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* SETS NO CONFRONTO */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Sets Disputados</span>
                    <div className="text-lg font-black text-slate-900">
                      {confrontoData.setsVencidosUsuario} <span className="text-slate-400 font-normal">×</span> {confrontoData.setsVencidosAdversario}
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 block">
                      {confrontoData.setsVencidosUsuario >= confrontoData.setsVencidosAdversario ? 'Saldo positivo em sets' : 'Saldo negativo em sets'}
                    </span>
                  </div>

                  {/* GAMES NO CONFRONTO */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Games Ganhos × Cedidos</span>
                    <div className="text-lg font-black text-slate-900">
                      {confrontoData.gamesGanhosUsuario} <span className="text-slate-400 font-normal">×</span> {confrontoData.gamesGanhosAdversario}
                    </div>
                    <span className={`text-[11px] font-black ${confrontoData.saldoGamesUsuario >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Saldo: {confrontoData.saldoGamesUsuario >= 0 ? `+${confrontoData.saldoGamesUsuario}` : confrontoData.saldoGamesUsuario}
                    </span>
                  </div>

                  {/* AÇÃO: DESAFIAR / REVANCHE */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-center space-y-2">
                    <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Novo Jogo</span>
                    <button
                      type="button"
                      onClick={() => {
                        setOpponentToChallenge(confrontoData.adversario.id);
                        setShowJogarModal(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Swords className="w-3.5 h-3.5" />
                      <span>Desafiar Jogador</span>
                    </button>
                  </div>

                </div>

                {/* HISTÓRICO DE PARTIDAS DIRETAS */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Histórico de Partidas Diretas ({confrontoData.ultimosConfrontos.length})
                  </h4>

                  {confrontoData.ultimosConfrontos.length === 0 ? (
                    <div className="p-6 rounded-2xl bg-slate-50 text-center text-slate-500 text-xs font-bold border border-slate-100">
                      Nenhuma partida finalizada entre vocês ainda. Marque um jogo para inaugurar o histórico!
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {confrontoData.ultimosConfrontos.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5"
                        >
                          <div className="flex items-center justify-between">
                            {c.isWO ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                                W.O.
                              </span>
                            ) : c.vitoriaUsuario ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-500 text-white shadow-2xs flex items-center gap-1">
                                <Trophy className="w-3 h-3" />
                                <span>VITÓRIA</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-500 text-white shadow-2xs">
                                DERROTA
                              </span>
                            )}

                            <span className="text-[11px] font-bold text-slate-500">{c.dataTexto}</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Placar</span>
                            {c.sets.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {c.sets.map((s, sIdx) => (
                                  <span
                                    key={sIdx}
                                    className="px-2.5 py-0.5 rounded-lg bg-white border border-slate-200 text-xs font-black text-slate-900 shadow-2xs"
                                  >
                                    {s.label}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs font-black text-slate-800">{c.placarTexto}</span>
                            )}
                          </div>

                          <div className="text-[11px] font-medium text-slate-400 pt-1 border-t border-slate-200/60 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{c.quadraTexto}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            ) : null}

          </div>

        </div>
      )}

      {/* ---------------- ABA 2: MINHAS PARTIDAS ---------------- */}
      {activeTab === 'PARTIDAS' && (
        <div className="space-y-5 animate-in fade-in">
          
          {/* DESAFIOS RECEBIDOS PENDENTES DE ACEITE */}
          {pendingChallenges.length > 0 && (
            <DesafiosRecebidosCard
              challenges={pendingChallenges}
              currentUserId={user.id}
              onAccept={handleAcceptChallenge}
              onReject={handleRejectChallenge}
            />
          )}

          {/* NAVEGAÇÃO ENTRE ABAS: PRÓXIMAS PARTIDAS / HISTÓRICO */}
          <div className="flex items-center gap-2 p-1 bg-slate-100/90 rounded-2xl w-fit border border-slate-200/80">
            <button
              type="button"
              onClick={() => setMatchTab('PROXIMAS')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                matchTab === 'PROXIMAS'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>PRÓXIMAS PARTIDAS</span>
              {proximasPartidas.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  matchTab === 'PROXIMAS' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {proximasPartidas.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setMatchTab('HISTORICO')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                matchTab === 'HISTORICO'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>HISTÓRICO</span>
              {historicoPartidas.length > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                  matchTab === 'HISTORICO' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {historicoPartidas.length}
                </span>
              )}
            </button>
          </div>

          {/* ======================================================== */}
          {/* CONTEÚDO DA ABA 1: PRÓXIMAS PARTIDAS */}
          {/* ======================================================== */}
          {matchTab === 'PROXIMAS' && (
            <div>
              {proximasPartidas.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 sm:p-12 text-center border border-slate-200 text-slate-400 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                    <Calendar className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Você ainda não possui partidas confirmadas.</p>
                    <p className="text-xs text-slate-400 mt-1">Marque um jogo com um adversário para disputar.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowJogarModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black transition-all cursor-pointer shadow-md inline-flex items-center gap-1.5 mt-2"
                  >
                    <Swords className="w-4 h-4" />
                    <span>🎾 Marcar um Jogo</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {proximasPartidas.map((m) => {
                    const isJ1 = m.jogador_1_id === user.id;
                    const opp = isJ1 ? m.jogador_2 : m.jogador_1;
                    const oppName = opp?.nome || 'Adversário';
                    const oppPhoto = opp?.foto_url;
                    const oppClass = isJ1 ? m.jogador_2_classe : m.jogador_1_classe;
                    const dateFormatted = m.reserva?.data ? formatBrDate(m.reserva.data) : (m.criado_em ? formatBrDate(formatCivilDate(m.criado_em)) : '');
                    const timeFormatted = m.reserva?.horario_label || (m.reserva?.horario?.hora_inicio ? m.reserva.horario.hora_inicio.slice(0, 5) : '');
                    const dateTimeDisplay = timeFormatted ? `${dateFormatted} às ${timeFormatted}` : dateFormatted;
                    const courtDisplay = m.reserva?.quadra?.nome || (m.reserva?.quadra_numero ? `Quadra ${m.reserva.quadra_numero}` : 'Quadra Principal');
                    const groupDisplay = m.grupo?.nome || activeGroup.nome;

                    const canReport = ['CONFIRMADA', 'ACEITA', 'AGUARDANDO_RESULTADO', 'REALIZADA'].includes(m.status);
                    const canConfirm = m.status === 'AGUARDANDO_CONFIRMACAO_RESULTADO' && m.resultado_informado_por !== user.id;

                    return (
                      <div
                        key={m.id}
                        className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3.5">
                          {/* CABEÇALHO DO CARTÃO: PRÓXIMA PARTIDA E STATUS */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-800 border border-slate-200">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span>PRÓXIMA PARTIDA</span>
                            </span>

                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200">
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              <span>Partida confirmada</span>
                            </span>
                          </div>

                          {/* IDENTIFICAÇÃO DO ADVERSÁRIO */}
                          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-slate-50/80 border border-slate-100">
                            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden shadow-xs">
                              {oppPhoto ? (
                                <img src={oppPhoto} alt={oppName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span>{oppName.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                                Adversário
                              </span>
                              <h4 className="text-sm font-black text-slate-900 truncate">{oppName}</h4>
                              {oppClass && (
                                <span className="inline-block mt-0.5 text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  {oppClass}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* DETALHES DA PARTIDA */}
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-2 text-slate-700 font-bold">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{dateTimeDisplay}</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-700 font-bold">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{courtDisplay}</span>
                            </div>
                            <div className="text-[11px] font-extrabold text-slate-400 pl-5.5">
                              {groupDisplay}
                            </div>
                          </div>
                        </div>

                        {/* BOTÕES DE AÇÃO */}
                        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                          {canConfirm && (
                            <button
                              type="button"
                              onClick={() => setSelectedMatchForConfirm(m)}
                              className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-colors cursor-pointer"
                            >
                              Conferir Placar
                            </button>
                          )}

                          {canReport && !canConfirm && (
                            <button
                              type="button"
                              onClick={() => setSelectedMatchForScore(m)}
                              className="flex-1 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black transition-colors cursor-pointer"
                            >
                              Informar Resultado
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedMatchForDetails(m)}
                            className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors cursor-pointer"
                          >
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* CONTEÚDO DA ABA 2: HISTÓRICO */}
          {/* ======================================================== */}
          {matchTab === 'HISTORICO' && (
            <div>
              {historicoPartidas.length === 0 ? (
                <div className="bg-white rounded-3xl p-10 sm:p-12 text-center border border-slate-200 text-slate-400 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400">
                    <Trophy className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-700">Você ainda não possui partidas concluídas.</p>
                    <p className="text-xs text-slate-400 mt-1">Assim que disputar e confirmar o resultado de uma partida, ela ficará registrada aqui no seu histórico esportivo.</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {historicoPartidas.map((m) => {
                    const isJ1 = m.jogador_1_id === user.id;
                    const me = isJ1 ? m.jogador_1 : m.jogador_2;
                    const myName = me?.nome || user.nome;
                    const opp = isJ1 ? m.jogador_2 : m.jogador_1;
                    const oppName = opp?.nome || 'Adversário';
                    const oppPhoto = opp?.foto_url;
                    const oppClass = isJ1 ? m.jogador_2_classe : m.jogador_1_classe;

                    const isWinner = m.vencedor_id === user.id;
                    const isLoser = !!m.vencedor_id && m.vencedor_id !== user.id;
                    const isWO = m.detalhes_placar?.toUpperCase().includes('W.O.') || m.detalhes_placar?.toUpperCase().includes('WO');

                    const dateFormatted = m.reserva?.data ? formatBrDate(m.reserva.data) : (m.finalizado_em ? formatBrDate(formatCivilDate(m.finalizado_em)) : (m.criado_em ? formatBrDate(formatCivilDate(m.criado_em)) : ''));
                    const courtDisplay = m.reserva?.quadra?.nome || (m.reserva?.quadra_numero ? `Quadra ${m.reserva.quadra_numero}` : 'Quadra');
                    const groupDisplay = m.grupo?.nome || activeGroup.nome;

                    const formattedSets = getFormattedSetsForUser(m);

                    return (
                      <div
                        key={m.id}
                        className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                      >
                        <div className="space-y-3.5">
                          {/* SELO DE RESULTADO (VITÓRIA / DERROTA / WO) */}
                          <div className="flex items-center justify-between gap-2">
                            {isWO ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                                <span>W.O.</span>
                              </span>
                            ) : isWinner ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500 text-white shadow-xs">
                                <Trophy className="w-3.5 h-3.5" />
                                <span>VITÓRIA</span>
                              </span>
                            ) : isLoser ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500 text-white shadow-xs">
                                <span>DERROTA</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-200 text-slate-800">
                                <span>CONCLUÍDA</span>
                              </span>
                            )}

                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-500">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{dateFormatted}</span>
                            </div>
                          </div>

                          {/* CONFRONTO: MEU NOME × ADVERSÁRIO */}
                          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0">
                                <h4 className="text-sm font-black text-slate-900 truncate">
                                  {myName} <span className="text-slate-400 font-bold">×</span> {oppName}
                                </h4>
                                {oppClass && (
                                  <span className="text-[10px] font-bold text-slate-500 block mt-0.5">
                                    Adversário: {oppClass}
                                  </span>
                                )}
                              </div>

                              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0 overflow-hidden shadow-xs">
                                {oppPhoto ? (
                                  <img src={oppPhoto} alt={oppName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <span>{oppName.charAt(0).toUpperCase()}</span>
                                )}
                              </div>
                            </div>

                            {/* PLACAR COMPLETO APRESENTADO NA PERSPECTIVA DO USUÁRIO */}
                            <div className="pt-2 border-t border-slate-200/70">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                                Placar da Partida
                              </span>
                              {formattedSets.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2">
                                  {formattedSets.map((s, idx) => (
                                    <div
                                      key={idx}
                                      className="px-3 py-1 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-900 shadow-2xs"
                                    >
                                      {s.label}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs font-black text-slate-800">
                                  {m.detalhes_placar || 'Sem detalhes de placar'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* INFORMAÇÕES DE QUADRA E CLUBE */}
                          <div className="flex items-center justify-between text-xs text-slate-600 font-bold px-1">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{courtDisplay}</span>
                            </div>
                            <span className="text-[11px] font-bold text-slate-400">{groupDisplay}</span>
                          </div>
                        </div>

                        {/* BOTÃO VER DETALHES */}
                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setSelectedMatchForDetails(m)}
                            className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors cursor-pointer text-center"
                          >
                            Ver detalhes
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ---------------- ABA 3: FEED DO CLUBE ---------------- */}
      {activeTab === 'FEED' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900">Feed de Partidas</h3>
              <p className="text-xs text-slate-500 font-medium">Fotos e resultados registrados pelos membros do clube</p>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {feedItems.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 space-y-2">
              <Camera className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs font-bold">Nenhuma foto de partida publicada no feed ainda.</p>
              <p className="text-[11px] text-slate-400">Tire uma foto ao final do seu próximo jogo!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {feedItems.map((item) => (
                <div
                  key={item.partida.id}
                  className="bg-white rounded-3xl overflow-hidden border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* FOTO OU BANNER */}
                    <div className="relative aspect-video bg-slate-900 overflow-hidden">
                      {item.fotoUrl ? (
                        <img
                          src={item.fotoUrl}
                          alt="Foto da partida"
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 text-white font-black text-sm">
                          🎾 {item.resultadoTexto}
                        </div>
                      )}

                      <div className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full bg-slate-950/75 backdrop-blur-xs text-white text-[10px] font-black">
                        {item.dataTexto}
                      </div>
                    </div>

                    {/* DETALHES DO JOGO */}
                    <div className="p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs font-black text-slate-900">
                        <span className="truncate">{item.autor.nome} × {item.adversario.nome}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-extrabold text-slate-600">{item.resultadoTexto}</span>
                        <span className="text-[11px] font-bold text-slate-400">{item.quadraTexto}</span>
                      </div>
                    </div>
                  </div>

                  {/* CURTIDAS & BOTÃO INTERATIVO */}
                  <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <button
                      type="button"
                      onClick={() => handleToggleFeedLike(item.partida.id)}
                      className={`flex items-center gap-1.5 text-xs font-black transition-transform active:scale-90 cursor-pointer ${
                        item.curtidoPeloUsuario ? 'text-rose-600' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Heart
                        className={`w-4 h-4 ${item.curtidoPeloUsuario ? 'fill-rose-600 text-rose-600' : ''}`}
                      />
                      <span>{item.curtidas}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedMatchForDetails(item.partida)}
                      className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ver Jogo</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. MODAIS DO MÓDULO */}
      {/* ======================================================== */}

      {/* MODAL DETALHES */}
      {selectedMatchForDetails && (
        <DetalhesPartidaModal
          partida={selectedMatchForDetails}
          session={session}
          isOpen={!!selectedMatchForDetails}
          onClose={() => setSelectedMatchForDetails(null)}
          onRefresh={loadData}
        />
      )}

      {/* MODAL INFORMAR RESULTADO */}
      {selectedMatchForScore && (
        <InformarResultadoModal
          partida={selectedMatchForScore}
          session={session}
          isOpen={!!selectedMatchForScore}
          onClose={() => setSelectedMatchForScore(null)}
          onSuccess={loadData}
        />
      )}

      {/* MODAL CONFIRMAR RESULTADO */}
      {selectedMatchForConfirm && (
        <ConfirmarResultadoModal
          partida={selectedMatchForConfirm}
          session={session}
          isOpen={!!selectedMatchForConfirm}
          onClose={() => setSelectedMatchForConfirm(null)}
          onSuccess={loadData}
        />
      )}

      {/* MODAL JOGAR FLOW */}
      {showJogarModal && (
        <JogarFlowModal
          session={session}
          isOpen={showJogarModal}
          preSelectedOpponentId={opponentToChallenge}
          onClose={() => {
            setShowJogarModal(false);
            setOpponentToChallenge(undefined);
          }}
          onSuccess={() => {
            setShowJogarModal(false);
            setOpponentToChallenge(undefined);
            loadData(true);
            onRefreshSession();
          }}
        />
      )}

      {/* MODAL DE ALTERAÇÃO DE SENHA */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900">Alterar Senha</h3>
              <button
                type="button"
                onClick={() => setShowPassModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {passFeedback && (
              <div className={`p-3 rounded-xl text-xs font-bold ${
                passFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'
              }`}>
                {passFeedback.message}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-3">
              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">Nova Senha</label>
                <input
                  type="password"
                  value={novaPass}
                  onChange={(e) => setNovaPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] font-black text-slate-400 block mb-1">Confirmar Nova Senha</label>
                <input
                  type="password"
                  value={confirmNovaPass}
                  onChange={(e) => setConfirmNovaPass(e.target.value)}
                  placeholder="Repita a nova senha"
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-[#0F172A] text-[#ccff00] text-xs font-black mt-2"
              >
                Salvar Nova Senha
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
