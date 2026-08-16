import React, { useState, useEffect } from 'react';
import { AuthSession, PlayerClass, PerfilRole, MemberStatus, Reserva } from '../types';
import { DbService } from '../lib/db';
import { toast, formatClassUpdateToastMessage } from '../lib/toast';
import { formatLocation } from '../lib/location';
import {
  User,
  Mail,
  Phone,
  Building2,
  Award,
  KeyRound,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  Edit2,
  Camera,
  AlertCircle
} from 'lucide-react';

interface PerfilUsuarioProps {
  session: AuthSession;
  onRefreshSession: () => void;
}

export const PerfilUsuario: React.FC<PerfilUsuarioProps> = ({ session, onRefreshSession }) => {
  const { user, activeGroup, activeRole, membros } = session;

  const currentMember = membros.find(m => m.usuario_id === user?.id && m.grupo_id === activeGroup?.id);
  const playerClass: PlayerClass = currentMember?.classe || 'Sem Classe';

  const [userBookings, setUserBookings] = useState<Reserva[]>([]);
  const completedCount = userBookings.length;

  // Form states (Apenas dados pessoais permitidos: nome, whatsapp, foto_url)
  const [nomeInput, setNomeInput] = useState(user?.nome || '');
  const [phoneInput, setPhoneInput] = useState(user?.whatsapp || '');
  const [fotoUrlInput, setFotoUrlInput] = useState(user?.foto_url || '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);

  useEffect(() => {
    setNomeInput(user?.nome || '');
    setPhoneInput(user?.whatsapp || '');
    setFotoUrlInput(user?.foto_url || '');
  }, [user]);

  // Password Modal State
  const [showPassModal, setShowPassModal] = useState(false);
  const [passAtual, setPassAtual] = useState('');
  const [novaPass, setNovaPass] = useState('');
  const [confirmNovaPass, setConfirmNovaPass] = useState('');
  const [passFeedback, setPassFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (user && activeGroup) {
      DbService.getUserBookingsAll(user.id, activeGroup.id).then((list) => {
        setUserBookings(list);
      });
    }
  }, [user?.id, activeGroup?.id]);

  if (!user || !activeGroup) return null;

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Atualização estritamente limitada aos dados pessoais autorizados em public.usuarios
      await DbService.updateUserProfile(user.id, {
        nome: nomeInput.trim(),
        whatsapp: phoneInput.trim(),
        foto_url: fotoUrlInput.trim() || null
      });

      setIsEditingProfile(false);
      onRefreshSession();

      const msg = 'Dados pessoais atualizados com sucesso!';
      toast.success(msg);
      setFeedback({ type: 'success', message: msg });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao atualizar perfil.');
      setFeedback({ type: 'error', message: err.message || 'Erro ao atualizar perfil.' });
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
      await DbService.changeUserPassword(user.id, passAtual, novaPass);
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

  const getClassBadgeStyle = (cls: PlayerClass) => {
    switch (cls) {
      case 'Classe A (1º)':
        return 'bg-amber-100 text-amber-900 border-amber-300 font-black';
      case 'Classe B (2º)':
        return 'bg-blue-100 text-blue-900 border-blue-300 font-bold';
      case 'Classe C (3º)':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
      case 'Classe D (4º)':
        return 'bg-purple-100 text-purple-900 border-purple-300 font-bold';
      case 'Classe E (5º)':
        return 'bg-rose-100 text-rose-900 border-rose-300 font-bold';
      case 'Classe F (6º)':
        return 'bg-cyan-100 text-cyan-900 border-cyan-300 font-bold';
      case 'Classe G (7º)':
        return 'bg-orange-100 text-orange-900 border-orange-300 font-bold';
      case 'Classe Infantil':
        return 'bg-pink-100 text-pink-900 border-pink-300 font-bold';
      case 'Classe Juvenil':
        return 'bg-indigo-100 text-indigo-900 border-indigo-300 font-bold';
      case 'Classe (50+)':
        return 'bg-teal-100 text-teal-900 border-teal-300 font-bold';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-sm font-bold flex items-center justify-between gap-3 shadow-md border ${
            feedback.type === 'success' ? 'bg-emerald-600 text-white border-emerald-500' : 'bg-rose-600 text-white border-rose-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span>{feedback.message}</span>
          </div>
        </div>
      )}

      {/* HEADER CARD */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          
          {/* Avatar / Photo */}
          <div className="relative group shrink-0">
            {user.foto_url ? (
              <img
                src={user.foto_url}
                alt={user.nome}
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl object-cover border-4 border-emerald-100 shadow-md"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-slate-900 text-white font-black text-3xl flex items-center justify-center border-4 border-slate-100 shadow-md">
                {user.nome.substring(0, 2).toUpperCase()}
              </div>
            )}
          </div>

          {/* User Basic Info */}
          <div className="text-center sm:text-left flex-1 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h2 className="text-2xl font-black text-slate-900">{user.nome}</h2>
              <span className={`self-center sm:self-auto px-3 py-1 rounded-xl text-xs border uppercase tracking-wider ${getClassBadgeStyle(playerClass)}`}>
                {playerClass}
              </span>
            </div>

            <p className="text-xs text-slate-500 font-semibold flex items-center justify-center sm:justify-start gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>{activeGroup.nome} ({formatLocation(activeGroup.cidade, activeGroup.estado)})</span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border border-slate-200">
                {activeRole}
              </span>
            </p>

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-2 text-xs font-bold text-slate-600">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {user.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                {user.whatsapp}
              </span>
            </div>
          </div>

          {/* Edit / Change Pass Buttons */}
          <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setIsEditingProfile(!isEditingProfile)}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-600" />
              <span>{isEditingProfile ? 'Cancelar Edição' : 'Editar Dados'}</span>
            </button>
            <button
              onClick={() => setShowPassModal(true)}
              className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-400" />
              <span>Alterar Senha</span>
            </button>
          </div>

        </div>
      </div>

      {/* EDIT PROFILE FORM */}
      {isEditingProfile && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-md space-y-4 animate-in fade-in duration-150">
          <h3 className="font-black text-slate-900 text-sm border-b border-slate-100 pb-3">Editar Informações Pessoais</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">Nome Completo</label>
              <input
                type="text"
                value={nomeInput}
                onChange={(e) => setNomeInput(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase text-slate-500">WhatsApp / Celular</label>
              <input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-bold uppercase text-slate-500">URL da Foto de Perfil (Opcional)</label>
              <input
                type="url"
                value={fotoUrlInput}
                onChange={(e) => setFotoUrlInput(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="submit"
              className="px-6 py-2.5 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] font-extrabold text-xs shadow-md transition-all cursor-pointer"
            >
              Salvar Alterações
            </button>
          </div>
        </form>
      )}

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total de Reservas</span>
          <span className="text-2xl font-black text-slate-900">{completedCount} Agendamentos</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Classe do Jogador</span>
          <span className="text-2xl font-black text-amber-600">{playerClass}</span>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-2xs space-y-1 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Grupo Atual</span>
          <span className="text-xl font-black text-slate-900 truncate block">{activeGroup.nome}</span>
        </div>
      </div>

      {/* RECENT GAMES LIST */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-black text-slate-900 text-base flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span>Meus Últimos Jogos Agendados</span>
          </h3>
          <span className="text-xs font-bold text-slate-400">{userBookings.length} Registros</span>
        </div>

        {userBookings.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs font-medium">
            Você ainda não possui histórico de jogos neste grupo.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {userBookings.slice(0, 5).map((booking) => (
              <div key={booking.id} className="py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 font-black text-xs flex items-center justify-center shrink-0">
                    Q{booking.quadra_numero}
                  </div>
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs sm:text-sm">
                      Quadra {booking.quadra_numero} — {booking.horario_label}
                    </h5>
                    <span className="text-[11px] font-medium text-slate-500">
                      Data: {booking.data}
                    </span>
                  </div>
                </div>

                <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                  Confirmado (Meu Horário)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CHANGE PASSWORD MODAL */}
      {showPassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-6 animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-slate-900 text-emerald-400 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900">Alterar Senha de Acesso</h3>
                <p className="text-xs text-slate-500 font-medium">Digite sua senha atual e escolha uma nova senha.</p>
              </div>
            </div>

            {passFeedback && (
              <div className={`p-3 rounded-2xl text-xs font-bold ${
                passFeedback.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'
              }`}>
                {passFeedback.message}
              </div>
            )}

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500">Senha Atual</label>
                <input
                  type="password"
                  required
                  value={passAtual}
                  onChange={(e) => setPassAtual(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500">Nova Senha (Mínimo 6 dígitos)</label>
                <input
                  type="password"
                  required
                  value={novaPass}
                  onChange={(e) => setNovaPass(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold uppercase text-slate-500">Confirmar Nova Senha</label>
                <input
                  type="password"
                  required
                  value={confirmNovaPass}
                  onChange={(e) => setConfirmNovaPass(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPassModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-2xl bg-[#0F172A] hover:bg-slate-800 text-[#ccff00] font-extrabold text-xs shadow-md cursor-pointer"
                >
                  Confirmar Nova Senha
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
