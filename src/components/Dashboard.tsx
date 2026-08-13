import React, { useState, useEffect } from 'react';
import { AuthSession, MembroGrupo, MemberStatus, PerfilRole, PlayerClass, ESTADOS_BRASIL, Grupo, Usuario } from '../types';
import { DbService } from '../lib/db';
import { toast } from '../lib/toast';
import { formatLocation } from '../lib/location';
import { getSupabaseClient } from '../lib/supabase';
import { AgendaReservas } from './AgendaReservas';
import { AdminPanel } from './AdminPanel';
import { HistoricoReservas } from './HistoricoReservas';
import { PerfilUsuario } from './PerfilUsuario';
import { VisaoGeralOwner } from './VisaoGeralOwner';
import { JogadoresManager } from './JogadoresManager';
import {
  Users,
  UserCheck,
  UserX,
  Clock,
  Building2,
  ShieldCheck,
  Search,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Settings,
  PlusCircle,
  Phone,
  Mail,
  User,
  Share2,
  Lock,
  Edit2,
  AlertCircle,
  Shield,
  KeyRound,
  ExternalLink,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  LogOut
} from 'lucide-react';

interface DashboardProps {
  session: AuthSession;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onUpdateSession: (session: AuthSession) => void;
  onOpenCreateGroup: () => void;
  viewMode?: 'MANAGER' | 'PLAYER';
}

export const Dashboard: React.FC<DashboardProps> = ({
  session,
  activeTab,
  setActiveTab,
  onUpdateSession,
  onOpenCreateGroup,
}) => {
  const { user, activeGroup, activeRole } = session;

  const [members, setMembers] = useState<MembroGrupo[]>([]);
  const [userGroups, setUserGroups] = useState<{ group: Grupo; member: MembroGrupo }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Group Edit State
  const [groupNome, setGroupNome] = useState(activeGroup?.nome || '');
  const [groupCidade, setGroupCidade] = useState(activeGroup?.cidade || '');
  const [groupEstado, setGroupEstado] = useState(activeGroup?.estado || 'SP');
  const [groupLogo, setGroupLogo] = useState(activeGroup?.logo_url || '');

  // Join Code State
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinMsg, setJoinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmittingJoin, setIsSubmittingJoin] = useState(false);

  // Sync state when activeGroup changes
  useEffect(() => {
    if (activeGroup) {
      DbService.getGroupMembers(activeGroup.id).then((groupMembers) => {
        setMembers(groupMembers);
      });
      if (user) {
        DbService.getGroupsForUser(user.id).then((groups) => {
          setUserGroups(groups);
        });
      }
      setGroupNome(activeGroup.nome);
      setGroupCidade(activeGroup.cidade);
      setGroupEstado(activeGroup.estado);
      setGroupLogo(activeGroup.logo_url || '');
    }
  }, [activeGroup?.id, user?.id]);

  // Join Group by Code
  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setJoinMsg(null);
    const code = joinCodeInput.trim().toUpperCase();
    if (!code || !user) return;

    setIsSubmittingJoin(true);
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase não configurado');

      const { data: rpcRes, error: rpcErr } = await supabase.rpc('entrar_grupo_por_codigo', {
        p_codigo: code
      });

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Código do grupo inválido ou erro ao solicitar entrada.');
      }

      if (!rpcRes || !rpcRes.success) {
        throw new Error(rpcRes?.mensagem || 'Erro ao solicitar entrada no grupo.');
      }

      setJoinMsg({
        type: 'success',
        text: 'Solicitação enviada. Aguarde a aprovação do administrador.'
      });
      setJoinCodeInput('');

      const updatedSession = await DbService.loadSession(user.id);
      onUpdateSession(updatedSession);
    } catch (err: any) {
      setJoinMsg({
        type: 'error',
        text: err.message || 'Erro ao tentar solicitar entrada.'
      });
    } finally {
      setIsSubmittingJoin(false);
    }
  };

  const hasActiveOrPendingGroup = session.membros.some(
    (m) => m.status === 'ATIVO' || m.status === 'PENDENTE'
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);

  const handleRefreshSession = async () => {
    if (user) {
      setIsRefreshing(true);
      try {
        const updated = await DbService.loadSession(user.id);
        onUpdateSession(updated);
      } catch (err) {
        console.error('Erro ao atualizar sessão:', err);
      } finally {
        setIsRefreshing(false);
      }
    }
  };

  const currentMember = session.membros.find(
    (m) => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id
  );

  const userRole = currentMember?.perfil || session.activeRole || 'JOGADOR';
  const userStatus = currentMember?.status || 'PENDENTE';

  const isPending = userStatus === 'PENDENTE';
  const isOwner = userRole === 'PROPRIETARIO' && userStatus === 'ATIVO';
  const isAdmin = userRole === 'ADMINISTRADOR' && userStatus === 'ATIVO';
  const isOwnerOrAdmin = isOwner || isAdmin;

  const handleCancelRequest = async () => {
    if (!currentMember || !user) return;
    if (!confirm('Deseja realmente cancelar sua solicitação de entrada no grupo?')) return;

    setIsCanceling(true);
    try {
      const updated = await DbService.cancelMembershipRequest(currentMember.id, user.id);
      onUpdateSession(updated);
      toast.success('Solicitação cancelada com sucesso.');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao cancelar solicitação.');
    } finally {
      setIsCanceling(false);
    }
  };

  const handleLogout = async () => {
    await DbService.logout();
    onUpdateSession(null as any);
  };

  if (!user) return null;

  if (!activeGroup || !hasActiveOrPendingGroup) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto text-3xl mb-2 shadow-xs">
              🎾
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Entrar em um grupo
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              Informe o código de convite do grupo fornecido pelo proprietário ou administrador para solicitar seu acesso.
            </p>
          </div>

          <form onSubmit={handleJoinByCode} className="space-y-4 max-w-md mx-auto">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Código do Grupo
              </label>
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="Ex: GRUPO9337"
                className="w-full px-4 py-3.5 rounded-2xl border-2 border-slate-200 text-slate-900 text-base font-mono font-bold tracking-widest uppercase focus:border-violet-600 focus:ring-4 focus:ring-violet-100 focus:outline-none bg-slate-50/50 transition-all"
                required
              />
            </div>

            {joinMsg && (
              <div className={`p-4 rounded-2xl text-xs sm:text-sm font-medium flex items-start gap-3 ${
                joinMsg.type === 'success' 
                  ? 'bg-emerald-50 border border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border border-rose-200 text-rose-900'
              }`}>
                {joinMsg.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                )}
                <p className="font-bold">{joinMsg.text}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmittingJoin}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#0F172A] hover:bg-slate-800 active:scale-[0.98] text-[#ccff00] font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isSubmittingJoin ? (
                <span>Enviando solicitação...</span>
              ) : (
                <span>Solicitar Entrada no Grupo</span>
              )}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center">
            <div className="text-xs text-slate-500">
              Deseja criar seu próprio grupo como proprietário?{' '}
              <button
                type="button"
                onClick={onOpenCreateGroup}
                className="text-violet-700 font-bold hover:underline"
              >
                Criar Novo Grupo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* BARREIRA DE ACESSO EXCLUSIVA PARA JOGADOR PENDENTE */
  if (isPending) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 animate-in fade-in duration-200">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200/80 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-3xl flex items-center justify-center mx-auto text-3xl shadow-xs">
            <Clock className="w-8 h-8 animate-pulse text-amber-600" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-xs font-black uppercase tracking-wider">
              Acesso Pendente de Aprovação
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight pt-2">
              {activeGroup?.nome}
            </h2>
            <p className="text-sm text-slate-600 max-w-md mx-auto font-medium">
              Sua solicitação está aguardando aprovação.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 text-left text-xs text-amber-900 space-y-1">
            <p className="font-extrabold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>O que acontece agora?</span>
            </p>
            <p className="pl-6 text-amber-800">
              O proprietário ou administrador do grupo analisará sua solicitação para liberar seu acesso às quadras e agendamentos.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleRefreshSession}
              disabled={isRefreshing}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Atualizar status</span>
            </button>

            {currentMember && (
              <button
                type="button"
                onClick={handleCancelRequest}
                disabled={isCanceling}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-extrabold text-xs border border-rose-200 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4 text-rose-600" />
                <span>Cancelar solicitação</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-slate-500" />
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* 1. VISÃO GERAL */}
      {activeTab === 'overview' && (
        <VisaoGeralOwner
          session={session}
          onNavigateTab={setActiveTab}
          onRefreshSession={handleRefreshSession}
        />
      )}

      {/* 2. AGENDA DE RESERVAS */}
      {activeTab === 'agenda' && (
        <AgendaReservas
          session={session}
          onRefreshSession={handleRefreshSession}
        />
      )}

      {/* 3. JOGADORES DO GRUPO */}
      {activeTab === 'members' && (
        <JogadoresManager
          session={session}
          onRefreshSession={handleRefreshSession}
        />
      )}

      {/* 4. ADMINISTRAÇÃO & CLASSES (PROTEGIDO) */}
      {(activeTab === 'admin_panel' || activeTab === 'admin_classes') && isOwnerOrAdmin && (
        <AdminPanel
          session={session}
          onRefreshSession={handleRefreshSession}
          initialTab={activeTab === 'admin_classes' ? 'classes' : 'dashboard'}
        />
      )}

      {/* 5. HISTÓRICO DE RESERVAS */}
      {activeTab === 'historico' && (
        <HistoricoReservas
          session={session}
          onRefreshSession={handleRefreshSession}
        />
      )}

      {/* 6. MEU PERFIL */}
      {activeTab === 'profile' && (
        <PerfilUsuario
          session={session}
          onRefreshSession={handleRefreshSession}
        />
      )}

    </div>
  );
};
