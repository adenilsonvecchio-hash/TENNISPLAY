import React, { useState } from 'react';
import { CadastroProprietarioData, CadastroJogadorData, AuthSession, ESTADOS_BRASIL } from '../types';
import { DbService } from '../lib/db';
import { X, Building2, ShieldCheck, UserCheck, AlertCircle, ArrowRight, Lock, Mail, Phone, User, MapPin, KeyRound, CheckCircle2 } from 'lucide-react';

interface AuthModalProps {
  mode: 'OWNER_REGISTER' | 'ADMIN_LOGIN' | 'PLAYER_REGISTER' | 'LOGIN';
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  onChangeMode: (newMode: 'OWNER_REGISTER' | 'ADMIN_LOGIN' | 'PLAYER_REGISTER' | 'LOGIN') => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  mode,
  onClose,
  onSuccess,
  onChangeMode,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const setMode = (newMode: 'OWNER_REGISTER' | 'ADMIN_LOGIN' | 'PLAYER_REGISTER' | 'LOGIN') => {
    setErrorMessage(null);
    setSuccessMessage(null);
    onChangeMode(newMode);
  };

  // Form states
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [nomeGrupo, setNomeGrupo] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('SP');
  const [codigoGrupo, setCodigoGrupo] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const session = await DbService.login(email, senha);
      onSuccess(session);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar login. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const handleOwnerRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (senha !== confirmarSenha) {
      setErrorMessage('As senhas não coincidem. Digite novamente.');
      return;
    }

    setLoading(true);

    try {
      const data: CadastroProprietarioData = {
        nome,
        email,
        whatsapp,
        senha,
        confirmarSenha,
        nomeGrupo,
        cidade,
        estado,
      };

      const result = await DbService.registerProprietario(data);
      if (result.requiresEmailConfirmation) {
        setSuccessMessage(result.message || 'Cadastro realizado. Confirme seu e-mail para continuar a criação do grupo.');
      } else if (result.session) {
        onSuccess(result.session);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao cadastrar proprietário e grupo.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (senha !== confirmarSenha) {
      setErrorMessage('As senhas não coincidem. Digite novamente.');
      return;
    }

    if (!codigoGrupo.trim()) {
      setErrorMessage('O Código de Convite do Grupo é OBRIGATÓRIO para se cadastrar como jogador. Digite o código fornecido pelo seu clube.');
      return;
    }

    setLoading(true);

    try {
      const data: CadastroJogadorData = {
        nome,
        email,
        whatsapp,
        senha,
        confirmarSenha,
        codigoGrupo: codigoGrupo.trim(),
      };

      const result = await DbService.registerJogador(data);
      if (result.requiresEmailConfirmation) {
        setSuccessMessage(result.message || 'Cadastro realizado. Confirme seu e-mail para solicitar acesso ao grupo.');
      } else if (result.session) {
        onSuccess(result.session);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao realizar cadastro do jogador.');
    } finally {
      setLoading(false);
    }
  };

  const getHeaderInfo = () => {
    switch (mode) {
      case 'OWNER_REGISTER':
        return {
          title: 'Cadastro do Proprietário',
          subtitle: 'Crie sua conta e seu grupo de tênis em um único passo.',
          icon: '🏢',
          badge: 'Proprietário',
          bgBadge: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
        };
      case 'ADMIN_LOGIN':
        return {
          title: 'Portal do Administrador',
          subtitle: 'Acesse o grupo para o qual foi convidado.',
          icon: '🛡️',
          badge: 'Administrador',
          bgBadge: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
        };
      case 'PLAYER_REGISTER':
        return {
          title: 'Cadastro do Jogador',
          subtitle: 'Crie seu perfil para solicitar entrada em grupos de tênis.',
          icon: '🎾',
          badge: 'Jogador',
          bgBadge: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
        };
      default:
        return {
          title: 'Entrar no TennisPlay',
          subtitle: 'Acesse sua conta para visualizar seus grupos e informações.',
          icon: '🔑',
          badge: 'Acesso Restrito',
          bgBadge: 'bg-[#0F172A] text-[#ccff00] border-slate-800',
        };
    }
  };

  const headerInfo = getHeaderInfo();

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl my-8 overflow-hidden relative">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar janela de autenticação"
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="px-6 sm:px-8 pt-8 pb-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">{headerInfo.icon}</span>
            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${headerInfo.bgBadge}`}>
                {headerInfo.badge}
              </span>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1">
                {headerInfo.title}
              </h3>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            {headerInfo.subtitle}
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 sm:mx-8 mt-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">Atenção</p>
              <p className="mt-0.5">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Success / Email Confirmation Alert */}
        {successMessage && (
          <div className="mx-6 sm:mx-8 mt-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm font-medium flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-extrabold text-sm text-emerald-950">Confirmação de E-mail Enviada</p>
                <p className="mt-1 text-emerald-800 leading-relaxed font-medium">{successMessage}</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-200/60">
              <button
                type="button"
                onClick={() => setMode('LOGIN')}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <span>Ir para Tela de Login</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* FORM CONTENT */}
        <div className="p-6 sm:p-8">
          
          {/* 1. LOGIN FORM & ADMIN LOGIN FORM */}
          {(mode === 'LOGIN' || mode === 'ADMIN_LOGIN') && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  E-mail de Acesso
                </label>
                <div className="relative">
                  <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@exemplo.com"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-[#ccff00] font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {loading ? (
                    <span>Acessando...</span>
                  ) : (
                    <>
                      <span>Entrar no Sistema</span>
                      <ArrowRight className="w-4 h-4 text-[#ccff00]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 2. CADASTRO DO PROPRIETÁRIO FORM */}
          {mode === 'OWNER_REGISTER' && (
            <form onSubmit={handleOwnerRegisterSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nome Completo *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      placeholder="Ex: Carlos Eduardo"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      required
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mail do Proprietário *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu.email@dominio.com.br"
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Senha *
                  </label>
                  <input
                    type="password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirmar Senha *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Group Fields */}
              <div className="p-4 bg-slate-100/90 rounded-2xl border border-slate-200 space-y-3 mt-4">
                <div className="flex items-center gap-2 text-slate-900 font-extrabold text-xs uppercase tracking-wider">
                  <Building2 className="w-4 h-4 text-slate-900" />
                  <span>Dados do Grupo de Tênis</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nome do Grupo (Academia / Clube / Condomínio) *
                  </label>
                  <input
                    type="text"
                    required
                    value={nomeGrupo}
                    onChange={(e) => setNomeGrupo(e.target.value)}
                    placeholder="Ex: Tangará Tênis Club"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Cidade *
                    </label>
                    <input
                      type="text"
                      required
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      placeholder="Ex: São Paulo"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      UF *
                    </label>
                    <select
                      value={estado}
                      onChange={(e) => setEstado(e.target.value)}
                      className="w-full px-2 py-2 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    >
                      {ESTADOS_BRASIL.map((st) => (
                        <option key={st.sigla} value={st.sigla}>
                          {st.sigla}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-[#ccff00] font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {loading ? (
                    <span>Criando Grupo e Conta...</span>
                  ) : (
                    <>
                      <span>Criar Meu Grupo e Cadastrar</span>
                      <ArrowRight className="w-4 h-4 text-[#ccff00]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* 3. CADASTRO DO JOGADOR FORM */}
          {mode === 'PLAYER_REGISTER' && (
            <form onSubmit={handlePlayerRegisterSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Roberto Santos"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    WhatsApp *
                  </label>
                  <input
                    type="text"
                    required
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="(11) 98888-7777"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  E-mail do Jogador *
                </label>
                <input
                  type="email"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jogador@email.com"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Senha *
                  </label>
                  <input
                    type="password"
                    required
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Confirmar Senha *
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              {/* Group Code Input */}
              <div className="p-4 bg-slate-100/90 rounded-2xl border border-slate-200 space-y-2.5 mt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold text-slate-900 uppercase tracking-wider">
                    Código de Convite do Grupo *
                  </label>
                  {codigoGrupo && (
                    <button
                      type="button"
                      onClick={() => setCodigoGrupo('')}
                      className="text-[10px] font-bold text-slate-700 hover:underline cursor-pointer"
                    >
                      Limpar Código
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  required
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  value={codigoGrupo}
                  onChange={(e) => setCodigoGrupo(e.target.value.toUpperCase())}
                  placeholder="Digite o código (ex: CLUBE10)"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-900 font-mono font-bold text-sm bg-white uppercase tracking-widest focus:ring-2 focus:ring-slate-900 focus:outline-none"
                />

                <div className="text-[11px] text-slate-700 font-medium pt-1">
                  <p>
                    🔒 <strong>Obrigatório:</strong> Digite o código de convite exato fornecido pelo seu clube de tênis.
                  </p>
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#0F172A] hover:bg-slate-800 disabled:opacity-50 text-[#ccff00] font-extrabold text-sm shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
                >
                  {loading ? (
                    <span>Cadastrando...</span>
                  ) : (
                    <>
                      <span>Criar Perfil de Jogador</span>
                      <ArrowRight className="w-4 h-4 text-[#ccff00]" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Mode Switchers Footer */}
          <div className="mt-6 pt-6 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-slate-800">
            {mode !== 'LOGIN' && (
              <button
                type="button"
                onClick={() => onChangeMode('LOGIN')}
                className="text-slate-900 hover:underline cursor-pointer"
              >
                Já possui conta? Faça Login
              </button>
            )}

            {mode !== 'OWNER_REGISTER' && mode !== 'PLAYER_REGISTER' && (
              <button
                type="button"
                onClick={() => onChangeMode('OWNER_REGISTER')}
                className="text-slate-900 hover:underline cursor-pointer"
              >
                🏢 Criar Grupo (Proprietário)
              </button>
            )}

            {mode !== 'PLAYER_REGISTER' && (
              <button
                type="button"
                onClick={() => onChangeMode('PLAYER_REGISTER')}
                className="text-slate-900 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>🎾 Criar Conta (Jogador)</span>
              </button>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
