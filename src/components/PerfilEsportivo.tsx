import React, { useState, useEffect } from 'react';
import { AuthSession, EstatisticasJogador, Partida, FeedItem, PlayerClass, RankingJogador } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import { formatLocation } from '../lib/location';
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
  Zap
} from 'lucide-react';
import { InformarResultadoModal } from './InformarResultadoModal';
import { ConfirmarResultadoModal } from './ConfirmarResultadoModal';
import { DetalhesPartidaModal } from './DetalhesPartidaModal';
import { JogarFlowModal } from './JogarFlowModal';

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
  const [matchSubFilter, setMatchSubFilter] = useState<'TODAS' | 'PROXIMAS' | 'FINALIZADAS' | 'CANCELADAS'>('TODAS');

  // Stats & Matches & Feed
  const [stats, setStats] = useState<EstatisticasJogador | null>(null);
  const [matches, setMatches] = useState<Partida[]>([]);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [rankingPos, setRankingPos] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Modals
  const [selectedMatchForDetails, setSelectedMatchForDetails] = useState<Partida | null>(null);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<Partida | null>(null);
  const [selectedMatchForConfirm, setSelectedMatchForConfirm] = useState<Partida | null>(null);
  const [showJogarModal, setShowJogarModal] = useState(false);

  // Edit Profile / Password Modal
  const [showPassModal, setShowPassModal] = useState(false);
  const [passAtual, setPassAtual] = useState('');
  const [novaPass, setNovaPass] = useState('');
  const [confirmNovaPass, setConfirmNovaPass] = useState('');
  const [passFeedback, setPassFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [isEditingData, setIsEditingData] = useState(false);
  const [editNome, setEditNome] = useState(user?.nome || '');
  const [editPhone, setEditPhone] = useState(user?.whatsapp || '');

  const loadData = async () => {
    if (!user || !activeGroup) return;

    try {
      const [statsData, matchesData, feedData, rankingData] = await Promise.all([
        DbService.getPlayerStatistics(user.id, activeGroup.id),
        DbService.getMatchesForUser(user.id, activeGroup.id),
        DbService.getGroupFeed(activeGroup.id, user.id),
        DbService.getGroupRanking(activeGroup.id).catch(() => [])
      ]);

      setStats(statsData);
      setMatches(matchesData);
      setFeedItems(feedData);

      const userRank = rankingData.find((r) => r.usuario.id === user.id);
      if (userRank) setRankingPos(userRank.posicao);
    } catch (err: any) {
      console.error('Erro ao carregar perfil esportivo:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id, activeGroup?.id]);

  useEffect(() => {
    setEditNome(user?.nome || '');
    setEditPhone(user?.whatsapp || '');
  }, [user]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
    onRefreshSession();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const { publicUrl } = await DbService.uploadUserAvatar(file, user.id);
      await DbService.updateUserProfile(user.id, { foto_url: publicUrl });
      toast.success('Foto de perfil atualizada!');
      onRefreshSession();
      loadData();
    } catch (err: any) {
      console.error('Erro ao atualizar foto:', err);
      toast.error(err.message || 'Erro ao enviar foto.');
    } finally {
      setUploadingAvatar(false);
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

  if (!user || !activeGroup) return null;

  // Filtragem de partidas
  const filteredMatches = matches.filter((m) => {
    if (matchSubFilter === 'PROXIMAS') {
      return ['CONFIRMADA', 'AGUARDANDO_RESULTADO', 'AGUARDANDO_CONFIRMACAO_RESULTADO'].includes(m.status);
    }
    if (matchSubFilter === 'FINALIZADAS') {
      return m.status === 'FINALIZADA';
    }
    if (matchSubFilter === 'CANCELADAS') {
      return m.status === 'CANCELADA';
    }
    return true;
  });

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
                {user.foto_url ? (
                  <img
                    src={user.foto_url}
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
                  type="file"
                  accept="image/*"
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

        </div>
      )}

      {/* ---------------- ABA 2: MINHAS PARTIDAS ---------------- */}
      {activeTab === 'PARTIDAS' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* SUB-FILTROS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {(['TODAS', 'PROXIMAS', 'FINALIZADAS', 'CANCELADAS'] as const).map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setMatchSubFilter(filter)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-black shrink-0 transition-all cursor-pointer ${
                  matchSubFilter === filter
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {filter === 'TODAS' && 'Todas as Partidas'}
                {filter === 'PROXIMAS' && 'Próximas'}
                {filter === 'FINALIZADAS' && 'Finalizadas'}
                {filter === 'CANCELADAS' && 'Canceladas'}
              </button>
            ))}
          </div>

          {filteredMatches.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 text-slate-400 space-y-3">
              <Trophy className="w-8 h-8 mx-auto opacity-50" />
              <p className="text-xs font-bold">Nenhuma partida encontrada neste filtro.</p>
              <button
                type="button"
                onClick={() => setShowJogarModal(true)}
                className="px-4 py-2 rounded-xl bg-[#0F172A] text-[#ccff00] text-xs font-black"
              >
                Marcar um Jogo Agora
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredMatches.map((m) => {
                const isJ1 = m.jogador_1_id === user.id;
                const oppName = isJ1 ? m.jogador_2?.nome || 'Adversário' : m.jogador_1?.nome || 'Adversário';
                const oppPhoto = isJ1 ? m.jogador_2?.foto_url : m.jogador_1?.foto_url;
                const oppClass = isJ1 ? m.jogador_2_classe : m.jogador_1_classe;

                const isWinner = m.vencedor_id === user.id;
                const isFinished = m.status === 'FINALIZADA';

                const canReport = ['CONFIRMADA', 'AGUARDANDO_RESULTADO', 'REALIZADA'].includes(m.status);
                const canConfirm = m.status === 'AGUARDANDO_CONFIRMACAO_RESULTADO' && m.resultado_informado_por !== user.id;

                return (
                  <div
                    key={m.id}
                    className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                  >
                    <div>
                      {/* HEADER DA PARTIDA */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>{m.reserva?.data || new Date(m.criado_em).toLocaleDateString('pt-BR')}</span>
                          {m.reserva?.horario_label && <span>· {m.reserva.horario_label}</span>}
                        </div>

                        {isFinished ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isWinner ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
                          }`}>
                            {isWinner ? 'Vitória' : 'Derrota'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-900">
                            {m.status === 'AGUARDANDO_CONFIRMACAO_RESULTADO' ? 'Aguardando Confirmação' : 'Confirmada'}
                          </span>
                        )}
                      </div>

                      {/* CONFRONTO VS */}
                      <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xs shrink-0 overflow-hidden">
                            {oppPhoto ? (
                              <img src={oppPhoto} alt={oppName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            ) : (
                              <span>{oppName.charAt(0).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-400 block">Adversário</span>
                            <h4 className="text-xs font-black text-slate-900 truncate">{oppName}</h4>
                            {oppClass && <span className="text-[9px] font-extrabold text-slate-500">{oppClass}</span>}
                          </div>
                        </div>

                        {/* PLACAR */}
                        {m.detalhes_placar ? (
                          <div className="text-right">
                            <span className="text-[10px] font-bold text-slate-400 block">Placar</span>
                            <span className="text-xs font-black text-slate-900">{m.detalhes_placar}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] font-bold text-slate-400">Quadra {m.reserva?.quadra_numero || 1}</span>
                        )}
                      </div>
                    </div>

                    {/* BOTÕES DE AÇÃO */}
                    <div className="flex items-center gap-2 pt-1">
                      {canConfirm && (
                        <button
                          type="button"
                          onClick={() => setSelectedMatchForConfirm(m)}
                          className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black transition-colors"
                        >
                          Conferir Placar
                        </button>
                      )}

                      {canReport && (
                        <button
                          type="button"
                          onClick={() => setSelectedMatchForScore(m)}
                          className="flex-1 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-black transition-colors"
                        >
                          Informar Resultado
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setSelectedMatchForDetails(m)}
                        className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black transition-colors"
                      >
                        Ver Detalhes
                      </button>
                    </div>
                  </div>
                );
              })}
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
          onClose={() => setShowJogarModal(false)}
          onSuccess={() => {
            loadData();
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
