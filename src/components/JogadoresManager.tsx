import React, { useState, useEffect } from 'react';
import { AuthSession, MembroGrupo, MemberStatus, PerfilRole, PlayerClass, Reserva, podeAlterarClasse } from '../types';
import { DbService } from '../lib/db';
import { toast, formatClassUpdateToastMessage } from '../lib/toast';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  UserCheck,
  UserX,
  Clock,
  Trash2,
  Calendar,
  AlertCircle,
  X,
  Phone,
  Mail,
  Sliders,
  History,
  Check
} from 'lucide-react';

interface JogadoresManagerProps {
  session: AuthSession;
  onRefreshSession: () => void;
}

export const JogadoresManager: React.FC<JogadoresManagerProps> = ({ session, onRefreshSession }) => {
  const { activeGroup, activeRole, user } = session;

  const [members, setMembers] = useState<MembroGrupo[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');

  // Approval Modal with Mandatory Class Definition
  const [approvalModal, setApprovalModal] = useState<{
    member: MembroGrupo;
    selectedClass: PlayerClass | '';
    errorMessage?: string;
  } | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  // Owner-only Class Change Confirmation Modal State
  const [classChangeModal, setClassChangeModal] = useState<{
    member: MembroGrupo;
    newClass: PlayerClass;
  } | null>(null);
  const [isSubmittingClass, setIsSubmittingClass] = useState(false);

  // Confirmation Modals State
  const [actionConfirm, setActionConfirm] = useState<{
    type: 'REMOVE' | 'BLOCK' | 'UNBLOCK' | 'ROLE';
    member: MembroGrupo;
    newRole?: PerfilRole;
  } | null>(null);

  // History Modal State
  const [historyMember, setHistoryMember] = useState<MembroGrupo | null>(null);
  const [historyBookings, setHistoryBookings] = useState<Reserva[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const canChangeClass = podeAlterarClasse(session);

  // 10 Opções válidas obrigatórias de classe para aprovação (sem "Sem Classe")
  const APPROVAL_CLASSES: { value: PlayerClass; label: string }[] = [
    { value: 'Classe A (1º)', label: 'Classe A (1º)' },
    { value: 'Classe B (2º)', label: 'Classe B (2º)' },
    { value: 'Classe C (3º)', label: 'Classe C (3º)' },
    { value: 'Classe D (4º)', label: 'Classe D (4º)' },
    { value: 'Classe E (5º)', label: 'Classe E (5º)' },
    { value: 'Classe F (6º)', label: 'Classe F (6º)' },
    { value: 'Classe G (7º)', label: 'Classe G (7º)' },
    { value: 'Classe Infantil', label: 'Classe Infantil' },
    { value: 'Classe Juvenil', label: 'Classe Juvenil' },
    { value: 'Classe (50+)', label: 'Classe 50+' },
  ];

  const loadMembers = async () => {
    if (!activeGroup) return;
    setLoading(true);
    try {
      const data = await DbService.getGroupMembers(activeGroup.id);
      setMembers(data);
    } catch (err: any) {
      console.error('Erro ao carregar jogadores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [activeGroup?.id]);

  if (!activeGroup || !user) return null;

  const isOwnerOrAdmin = activeRole === 'PROPRIETARIO' || activeRole === 'ADMINISTRADOR';

  // Action Handlers
  const handleOpenApprovalModal = (member: MembroGrupo) => {
    setApprovalModal({
      member,
      selectedClass: '',
      errorMessage: undefined,
    });
  };

  const handleConfirmApproval = async () => {
    if (!approvalModal || isApproving || !approvalModal.selectedClass) return;
    const { member, selectedClass } = approvalModal;

    setIsApproving(true);
    setApprovalModal((prev) => (prev ? { ...prev, errorMessage: undefined } : null));

    try {
      const result = await DbService.approveMemberWithClass(member.id, selectedClass);
      setMembers(result.members);
      if (onRefreshSession) {
        await onRefreshSession();
      }
      toast.success(result.message || `${member.usuario?.nome || 'Jogador'} foi aprovado na ${selectedClass}.`);
      setApprovalModal(null);
    } catch (err: any) {
      console.error('[Erro na aprovação do jogador]:', err);
      const msg = err.message || 'Erro ao aprovar jogador. Verifique suas permissões.';
      toast.error(msg);
      setApprovalModal((prev) => (prev ? { ...prev, errorMessage: msg } : null));
    } finally {
      setIsApproving(false);
    }
  };

  const handleConfirmClassChange = async () => {
    if (!classChangeModal || isSubmittingClass || !activeGroup) return;
    const { member, newClass } = classChangeModal;
    const isSelf = member.usuario_id === user?.id;
    const memberName = member.usuario?.nome || 'jogador';

    setIsSubmittingClass(true);
    try {
      const updated = await DbService.updateMemberClass(member.id, newClass, activeGroup.id);
      setMembers(updated);
      if (onRefreshSession) {
        await onRefreshSession();
      }
      toast.success(formatClassUpdateToastMessage(isSelf, memberName, newClass));
      setClassChangeModal(null);
    } catch (err: any) {
      console.error('Erro ao alterar classe:', err);
      toast.error(err.message || 'Não foi possível alterar a classe. Somente o proprietário tem permissão.');
      loadMembers();
    } finally {
      setIsSubmittingClass(false);
    }
  };

  const handleExecuteConfirmedAction = async () => {
    if (!actionConfirm) return;
    const { type, member, newRole } = actionConfirm;

    try {
      if (type === 'REMOVE') {
        const updated = await DbService.updateMemberStatus(member.id, 'BLOQUEADO');
        setMembers(updated);
      } else if (type === 'BLOCK') {
        const updated = await DbService.updateMemberStatus(member.id, 'BLOQUEADO');
        setMembers(updated);
      } else if (type === 'UNBLOCK') {
        const updated = await DbService.updateMemberStatus(member.id, 'ATIVO');
        setMembers(updated);
      } else if (type === 'ROLE' && newRole) {
        const updated = await DbService.updateMemberPerfil(member.id, newRole);
        setMembers(updated);
      }
      onRefreshSession();
      setActionConfirm(null);
      toast.success('Ação realizada com sucesso!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao realizar ação.');
    }
  };

  // Open History Modal
  const handleOpenHistory = async (member: MembroGrupo) => {
    setHistoryMember(member);
    setLoadingHistory(true);
    try {
      const allRes = await DbService.getUserBookingsAll(member.usuario_id, activeGroup.id);
      setHistoryBookings(allRes);
    } catch (err) {
      console.error('Erro ao buscar histórico do jogador:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Filtering Logic
  const filteredMembers = members.filter((m) => {
    const u = m.usuario;
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      u?.nome.toLowerCase().includes(search) ||
      u?.email.toLowerCase().includes(search) ||
      u?.whatsapp.includes(search);

    const matchesStatus = statusFilter === 'ALL' || m.status === statusFilter;

    let matchesClass = true;
    if (classFilter !== 'ALL') {
      if (classFilter === 'Sem Classe') {
        matchesClass = !m.classe || m.classe === 'Sem Classe';
      } else {
        matchesClass = m.classe === classFilter;
      }
    }

    return matchesSearch && matchesStatus && matchesClass;
  });

  const totalAtivos = members.filter(m => m.status === 'ATIVO').length;
  const totalPendentes = members.filter(m => m.status === 'PENDENTE').length;
  const totalBloqueados = members.filter(m => m.status === 'BLOQUEADO').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* 1. PAGE HEADER */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-[#ccff00] font-bold flex items-center justify-center text-xl shrink-0 shadow-2xs">
            <Users className="w-6 h-6 text-[#ccff00]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestão de Jogadores</h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              Gerencie a lista de membros do grupo, aprovações, atribuição de classes e permissões.
            </p>
          </div>
        </div>

        {/* Status Count Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-extrabold text-xs">
            {totalAtivos} Ativos
          </span>
          {totalPendentes > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-extrabold text-xs">
              {totalPendentes} Pendentes
            </span>
          )}
          {totalBloqueados > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs">
              {totalBloqueados} Inativos
            </span>
          )}
        </div>
      </div>

      {/* 2. SEARCH & FILTER BAR */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome, e-mail ou WhatsApp..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0F172A]"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ALL' ? 'bg-[#0F172A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos ({members.length})
            </button>
            <button
              onClick={() => setStatusFilter('ATIVO')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'ATIVO' ? 'bg-[#0F172A] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Ativos ({totalAtivos})
            </button>
            <button
              onClick={() => setStatusFilter('PENDENTE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                statusFilter === 'PENDENTE' ? 'bg-[#0F172A] text-[#ccff00] shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Pendentes ({totalPendentes})
            </button>
          </div>

        </div>

        {/* Class Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-700" />
            <span>Classe:</span>
          </span>
          {['ALL', 'Classe A (1º)', 'Classe B (2º)', 'Classe C (3º)', 'Classe D (4º)', 'Classe E (5º)', 'Classe F (6º)', 'Classe G (7º)', 'Classe Infantil', 'Classe Juvenil', 'Classe (50+)', 'Sem Classe'].map((cls) => (
            <button
              key={cls}
              onClick={() => setClassFilter(cls)}
              className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                classFilter === cls
                  ? 'bg-slate-900 text-[#ccff00]'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {cls === 'ALL' ? 'Todas as classes' : cls}
            </button>
          ))}
        </div>
      </div>

      {/* 3. PLAYERS LIST */}
      <div className="space-y-3">
        {filteredMembers.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-2">
            <Users className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold text-slate-700">Nenhum jogador encontrado.</p>
            <p className="text-xs text-slate-500">Tente ajustar o termo de busca ou os filtros acima.</p>
          </div>
        ) : (
          filteredMembers.map((m) => {
            const u = m.usuario;
            const isSelf = u?.id === user.id;

            return (
              <div
                key={m.id}
                className={`bg-white rounded-3xl p-5 border transition-all ${
                  m.status === 'PENDENTE'
                    ? 'border-amber-300 bg-amber-50/20 shadow-xs'
                    : 'border-slate-200/90 shadow-2xs hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  
                  {/* Left: Player Avatar & Info */}
                  <div className="flex items-center gap-3.5">
                    {u?.foto_url ? (
                      <img
                        src={u.foto_url}
                        alt={u.nome}
                        className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shrink-0 shadow-2xs"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-[#0F172A] text-[#ccff00] font-black text-sm flex items-center justify-center shrink-0 shadow-2xs uppercase">
                        {u?.nome ? u.nome.substring(0, 2) : 'U'}
                      </div>
                    )}

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-black text-slate-900">{u?.nome}</h4>
                        
                        {/* Perfil Badge */}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                          m.perfil === 'PROPRIETARIO'
                            ? 'bg-[#0F172A] text-[#ccff00] border-slate-800'
                            : m.perfil === 'ADMINISTRADOR'
                            ? 'bg-slate-900 text-white border-slate-700'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>
                          {m.perfil}
                        </span>

                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          m.status === 'ATIVO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.status === 'PENDENTE'
                            ? 'bg-amber-100 text-amber-900 font-extrabold'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {m.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap font-medium">
                        {u?.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{u.email}</span>
                          </span>
                        )}
                        {u?.whatsapp && (
                          <span className="flex items-center gap-1 font-semibold text-slate-700">
                            <Phone className="w-3.5 h-3.5 text-slate-400" />
                            <span>{u.whatsapp}</span>
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Membro desde {new Date(m.created_at).toLocaleDateString('pt-BR')}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Class Display, Owner-only Action & Other Actions */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    
                    {/* Class Display Badge (Sem select direto na lista) */}
                    <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-2xl border border-slate-200">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">Classe:</span>
                      <span className="text-xs font-black text-slate-900">{m.classe || 'Sem Classe'}</span>
                    </div>

                    {/* Owner-only "Alterar classe" action button with confirmation modal */}
                    {canChangeClass && m.status === 'ATIVO' && (
                      <button
                        type="button"
                        onClick={() => setClassChangeModal({ member: m, newClass: m.classe || 'Sem Classe' })}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                        title="Alterar classe do jogador (Exclusivo para o Proprietário)"
                      >
                        <Sliders className="w-3.5 h-3.5 text-slate-600" />
                        <span>Alterar classe</span>
                      </button>
                    )}

                    {/* Pending Approval Button */}
                    {isOwnerOrAdmin && m.status === 'PENDENTE' && (
                      <button
                        type="button"
                        onClick={() => handleOpenApprovalModal(m)}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                        title="Aprovar entrada do jogador definindo sua classe"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Aprovar Jogador</span>
                      </button>
                    )}

                    {/* History Button */}
                    <button
                      onClick={() => handleOpenHistory(m)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-all flex items-center gap-1 cursor-pointer"
                      title="Ver histórico do jogador"
                    >
                      <History className="w-3.5 h-3.5 text-slate-600" />
                      <span className="hidden sm:inline">Histórico</span>
                    </button>

                    {/* Owner Role Selector for self */}
                    {activeRole === 'PROPRIETARIO' && isSelf && (
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-2xl border border-slate-200">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">Papel:</span>
                        <select
                          value={m.perfil}
                          onChange={async (e) => {
                            const newRole = e.target.value as PerfilRole;
                            try {
                              const updated = await DbService.updateMemberPerfil(m.id, newRole);
                              setMembers(updated);
                              if (onRefreshSession) await onRefreshSession();
                              toast.success('Papel atualizado com sucesso!');
                            } catch (err: any) {
                              toast.error(err.message || 'Erro ao atualizar papel.');
                              loadMembers();
                            }
                          }}
                          className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer"
                        >
                          <option value="PROPRIETARIO">Proprietário</option>
                          <option value="ADMINISTRADOR">Administrador</option>
                          <option value="JOGADOR">Jogador</option>
                        </select>
                      </div>
                    )}

                    {/* Owner/Admin Management Actions */}
                    {isOwnerOrAdmin && !isSelf && m.perfil !== 'PROPRIETARIO' && (
                      <>
                        {/* Change Role */}
                        <button
                          onClick={() => setActionConfirm({
                            type: 'ROLE',
                            member: m,
                            newRole: m.perfil === 'ADMINISTRADOR' ? 'JOGADOR' : 'ADMINISTRADOR'
                          })}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-200 transition-all cursor-pointer"
                          title={m.perfil === 'ADMINISTRADOR' ? 'Rebaixar para Jogador' : 'Promover a Administrador'}
                        >
                          {m.perfil === 'ADMINISTRADOR' ? 'Rebaixar' : 'Promover'}
                        </button>

                        {/* Block/Unblock */}
                        {m.status === 'ATIVO' ? (
                          <button
                            onClick={() => setActionConfirm({ type: 'BLOCK', member: m })}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-amber-100 text-amber-700 border border-slate-200 transition-all cursor-pointer"
                            title="Suspender Acesso"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        ) : m.status === 'BLOQUEADO' ? (
                          <button
                            onClick={() => setActionConfirm({ type: 'UNBLOCK', member: m })}
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition-all cursor-pointer"
                            title="Reativar Acesso"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        ) : null}

                        {/* Remove */}
                        <button
                          onClick={() => setActionConfirm({ type: 'REMOVE', member: m })}
                          className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-all cursor-pointer"
                          title="Remover do Grupo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}

                  </div>

                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 4. CONFIRMATION DIALOG MODAL */}
      {actionConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <h3 className="text-lg font-black text-slate-900">Confirmar Ação</h3>
              </div>
              <button
                onClick={() => setActionConfirm(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm font-medium text-slate-700 leading-relaxed">
              {actionConfirm.type === 'REMOVE' && (
                <>Tem certeza de que deseja remover <strong>{actionConfirm.member.usuario?.nome}</strong> do grupo?</>
              )}
              {actionConfirm.type === 'BLOCK' && (
                <>Deseja suspender temporariamente o acesso do jogador <strong>{actionConfirm.member.usuario?.nome}</strong>?</>
              )}
              {actionConfirm.type === 'UNBLOCK' && (
                <>Deseja reativar o acesso de <strong>{actionConfirm.member.usuario?.nome}</strong> no grupo?</>
              )}
              {actionConfirm.type === 'ROLE' && (
                <>
                  Deseja alterar o perfil de <strong>{actionConfirm.member.usuario?.nome}</strong> para{' '}
                  <strong className="text-slate-900">{actionConfirm.newRole}</strong>?
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setActionConfirm(null)}
                className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteConfirmedAction}
                className="px-4 py-2.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] font-extrabold text-xs shadow-md cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. PLAYER HISTORY MODAL */}
      {historyMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 border border-slate-200 shadow-2xl max-h-[85vh] flex flex-col animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  Histórico de Partidas
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {historyMember.usuario?.nome} • {historyMember.classe || 'Sem Classe'}
                </p>
              </div>
              <button
                onClick={() => setHistoryMember(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 space-y-2 pr-1">
              {loadingHistory ? (
                <p className="text-center py-6 text-xs font-bold text-slate-500">
                  Carregando histórico do jogador...
                </p>
              ) : historyBookings.length === 0 ? (
                <p className="text-center py-6 text-xs font-bold text-slate-500">
                  Nenhuma reserva encontrada para este jogador neste grupo.
                </p>
              ) : (
                historyBookings.map((b) => (
                  <div
                    key={b.id}
                    className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-slate-900">
                        {new Date(b.data + 'T12:00:00').toLocaleDateString('pt-BR')} • {b.horario_label}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Quadra {b.quadra_numero}
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                      Confirmado
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2 border-t border-slate-100 text-right">
              <button
                onClick={() => setHistoryMember(null)}
                className="px-4 py-2 rounded-2xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. OWNER-ONLY CLASS CHANGE CONFIRMATION MODAL */}
      {classChangeModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#0F172A] text-[#ccff00] flex items-center justify-center font-black">
                  <Sliders className="w-4 h-4" />
                </div>
                <h3 className="font-black text-slate-900 text-base">Alterar Classe do Jogador</h3>
              </div>
              <button
                onClick={() => !isSubmittingClass && setClassChangeModal(null)}
                disabled={isSubmittingClass}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Jogador:</span>
                  <strong className="text-slate-900 text-xs font-black">{classChangeModal.member.usuario?.nome}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Classe Atual:</span>
                  <span className="font-extrabold text-amber-800 bg-amber-100/70 px-2.5 py-0.5 rounded-lg border border-amber-300/80">
                    {classChangeModal.member.classe || 'Sem Classe'}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase text-slate-600 block">Selecione a Nova Classe:</label>
                <select
                  value={classChangeModal.newClass}
                  disabled={isSubmittingClass}
                  onChange={(e) => setClassChangeModal({ ...classChangeModal, newClass: e.target.value as PlayerClass })}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer"
                >
                  <option value="Sem Classe">Sem Classe</option>
                  <option value="Classe A (1º)">Classe A (1º)</option>
                  <option value="Classe B (2º)">Classe B (2º)</option>
                  <option value="Classe C (3º)">Classe C (3º)</option>
                  <option value="Classe D (4º)">Classe D (4º)</option>
                  <option value="Classe E (5º)">Classe E (5º)</option>
                  <option value="Classe F (6º)">Classe F (6º)</option>
                  <option value="Classe G (7º)">Classe G (7º)</option>
                  <option value="Classe Infantil">Classe Infantil</option>
                  <option value="Classe Juvenil">Classe Juvenil</option>
                  <option value="Classe (50+)">Classe (50+)</option>
                </select>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 leading-relaxed">
                ℹ️ <strong>Regra de Negócio:</strong> Somente o proprietário do grupo possui permissão para definir ou alterar o nível técnico dos jogadores.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setClassChangeModal(null)}
                disabled={isSubmittingClass}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClassChange}
                disabled={isSubmittingClass}
                className="px-5 py-2.5 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] text-xs font-extrabold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSubmittingClass ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-[#ccff00] border-t-transparent rounded-full animate-spin" />
                    <span>Alterando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Confirmar Alteração</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MANDATORY CLASS PLAYER APPROVAL MODAL */}
      {approvalModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-200 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-xs">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Aprovar jogador</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Confirmação de entrada no grupo</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !isApproving && setApprovalModal(null)}
                disabled={isApproving}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="space-y-4 text-xs">
              {/* Dynamic message */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 font-medium leading-relaxed">
                Defina a classe de <strong className="font-black text-emerald-900">{approvalModal.member.usuario?.nome || 'este jogador'}</strong> para concluir a aprovação.
              </div>

              {/* Player Info Card */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Jogador:</span>
                  <strong className="text-slate-900 text-xs font-black">{approvalModal.member.usuario?.nome}</strong>
                </div>
                {approvalModal.member.usuario?.email && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">E-mail:</span>
                    <span className="text-slate-700 text-xs font-medium">{approvalModal.member.usuario.email}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Status Atual:</span>
                  <span className="font-extrabold text-amber-700 bg-amber-100/80 px-2.5 py-0.5 rounded-lg border border-amber-300">
                    PENDENTE
                  </span>
                </div>
              </div>

              {/* Mandatory Class Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  <span>Classe do jogador</span>
                  <span className="text-rose-500 font-black">*</span>
                </label>
                <select
                  value={approvalModal.selectedClass}
                  disabled={isApproving}
                  onChange={(e) =>
                    setApprovalModal({
                      ...approvalModal,
                      selectedClass: e.target.value as PlayerClass,
                      errorMessage: undefined,
                    })
                  }
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
                >
                  <option value="" disabled>
                    Selecione a classe obrigatória...
                  </option>
                  {APPROVAL_CLASSES.map((cls) => (
                    <option key={cls.value} value={cls.value}>
                      {cls.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 font-medium">
                  A definição de classe é obrigatória para que o jogador possa participar do ranking e desafios.
                </p>
              </div>

              {/* Error message if any */}
              {approvalModal.errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                  <span>{approvalModal.errorMessage}</span>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovalModal(null)}
                disabled={isApproving}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={!approvalModal.selectedClass || isApproving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {isApproving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Aprovando...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Aprovar jogador</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
