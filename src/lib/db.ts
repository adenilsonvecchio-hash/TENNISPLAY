import {
  AuthSession, CadastroJogadorData, CadastroProprietarioData, CourtConfig, DEFAULT_HORARIOS_PADRAO,
  Grupo, MemberStatus, MembroGrupo, Notificacao, PerfilRole, PlayerClass, DEFAULT_PLAYER_CLASSES, Quadra, Reserva, TimeSlot, Usuario
} from '../types';
import { getSupabaseClient } from './supabase';
import { normalizeLocation } from './location';
import { getDayOfWeek, getTodayCivilDate, formatCivilDate, isPastCivilDate, isPastTimeSlot } from './dateUtils';

const requireDb = () => {
  const db = getSupabaseClient();
  if (!db) throw new Error('Banco não configurado. Defina as variáveis do Supabase.');
  return db;
};

const fail = (context: string, error?: unknown): never => {
  const message = error ? (typeof error === 'object' && 'message' in error ? String((error as any).message) : String(error)) : '';
  if (message.includes('email rate limit exceeded') || message.includes('over_email_send_rate_limit')) {
    throw new Error('Limite temporário de envio de e-mails atingido. Aguarde alguns minutos antes de tentar novamente.');
  }
  if (error) {
    console.error(`[Supabase] ${context}:`, error);
  }
  throw new Error(message ? `${context}: ${message}` : context);
};

const roleFromDb = (value: string): PerfilRole => ({ proprietario: 'PROPRIETARIO', administrador: 'ADMINISTRADOR', jogador: 'JOGADOR' }[value] || 'JOGADOR') as PerfilRole;
const roleToDb = (value: PerfilRole) => ({ PROPRIETARIO: 'proprietario', ADMINISTRADOR: 'administrador', JOGADOR: 'jogador' }[value]);
const statusFromDb = (value: string): MemberStatus => ({ pendente: 'PENDENTE', ativo: 'ATIVO', bloqueado: 'BLOQUEADO', recusado: 'BLOQUEADO' }[value] || 'PENDENTE') as MemberStatus;
const statusToDb = (value: MemberStatus) => ({ PENDENTE: 'pendente', ATIVO: 'ativo', BLOQUEADO: 'bloqueado' }[value]);
const classMapFromLetter: Record<string, PlayerClass> = {
  A: 'Classe A (1º)',
  B: 'Classe B (2º)',
  C: 'Classe C (3º)',
  D: 'Classe D (4º)',
  E: 'Classe E (5º)',
  F: 'Classe F (6º)',
  G: 'Classe G (7º)',
  INFANTIL: 'Classe Infantil',
  JUVENIL: 'Classe Juvenil',
  '50+': 'Classe (50+)',
};

const classFromDb = (value?: string | null): PlayerClass => {
  if (!value) return 'Sem Classe';
  const val = String(value).trim();
  if (!val || val === 'Sem Classe' || val === 'null' || val === 'undefined') return 'Sem Classe';
  if (classMapFromLetter[val]) return classMapFromLetter[val];
  const validClasses: PlayerClass[] = [
    'Classe A (1º)', 'Classe B (2º)', 'Classe C (3º)', 'Classe D (4º)',
    'Classe E (5º)', 'Classe F (6º)', 'Classe G (7º)',
    'Classe Infantil', 'Classe Juvenil', 'Classe (50+)'
  ];
  if (validClasses.includes(val as PlayerClass)) return val as PlayerClass;
  const upper = val.toUpperCase();
  if (classMapFromLetter[upper]) return classMapFromLetter[upper];
  const letter = val.replace(/^Classe\s+/i, '').trim().toUpperCase();
  if (classMapFromLetter[letter]) return classMapFromLetter[letter];
  return 'Sem Classe';
};

const classToDb = (value?: PlayerClass | string | null): string | null => {
  if (!value || value === 'Sem Classe' || value === 'null' || value === 'undefined') return null;
  const str = String(value).trim();
  if (!str || str === 'Sem Classe') return null;

  if (str === 'A' || str.includes('A (1º)') || str === 'Classe A') return 'A';
  if (str === 'B' || str.includes('B (2º)') || str === 'Classe B') return 'B';
  if (str === 'C' || str.includes('C (3º)') || str === 'Classe C') return 'C';
  if (str === 'D' || str.includes('D (4º)') || str === 'Classe D') return 'D';
  if (str === 'E' || str.includes('E (5º)') || str === 'Classe E') return 'E';
  if (str === 'F' || str.includes('F (6º)') || str === 'Classe F') return 'F';
  if (str === 'G' || str.includes('G (7º)') || str === 'Classe G') return 'G';
  if (str === 'INFANTIL' || str.toLowerCase().includes('infantil')) return 'INFANTIL';
  if (str === 'JUVENIL' || str.toLowerCase().includes('juvenil')) return 'JUVENIL';
  if (str === '50+' || str.includes('50+')) return '50+';

  const upper = str.toUpperCase();
  if (['A', 'B', 'C', 'D', 'E', 'F', 'G', 'INFANTIL', 'JUVENIL', '50+'].includes(upper)) {
    return upper;
  }

  return null;
};

const mapUser = (row: any): Usuario => ({
  id: row.id, nome: row.nome, email: row.email || '', whatsapp: row.whatsapp || '',
  foto_url: row.avatar_url || null, created_at: row.criado_em
});

const mapGroup = (row: any): Grupo => {
  const { cidade, estado } = normalizeLocation(row.descricao, '');
  return {
    id: row.id,
    nome: row.nome,
    cidade,
    estado,
    logo_url: row.logo_url || null,
    imagem_path: row.imagem_path || null,
    ativo: row.ativo,
    created_at: row.criado_em,
    codigo_convite: row.codigo,
    default_qtd_quadras: row.default_qtd_quadras || 4,
    prazo_cancelamento_horas: row.prazo_cancelamento_horas || 2
  };
};

const mapMember = (row: any): MembroGrupo => ({
  id: row.id, usuario_id: row.usuario_id, grupo_id: row.grupo_id,
  perfil: roleFromDb(row.papel), status: statusFromDb(row.status), classe: classFromDb(row.classe),
  created_at: row.criado_em,
  usuario: row.usuario ? mapUser(row.usuario) : undefined,
  grupo: row.grupo ? mapGroup(row.grupo) : undefined
});

const generateCode = (name: string) => `${name.replace(/[^a-z0-9]/gi, '').slice(0, 5).toUpperCase() || 'TENIS'}${Math.floor(1000 + Math.random() * 9000)}`;
const timeText = (value: string) => value.slice(0, 5);

async function loadSession(userId: string): Promise<AuthSession> {
  const db = requireDb();
  const [{ data: userRow, error: userError }, { data: memberRows, error: memberError }] = await Promise.all([
    db.from('usuarios').select('*').eq('id', userId).single(),
    db.from('membros_grupo').select('*, grupo:grupos(*)').eq('usuario_id', userId)
  ]);
  if (userError) fail('Erro ao carregar perfil', userError);
  if (memberError) fail('Erro ao carregar grupos', memberError);
  const members = (memberRows || []).map(mapMember);
  const active = members.find((m) => m.status === 'ATIVO') || members.find((m) => m.status === 'PENDENTE') || members[0];
  return { user: mapUser(userRow), membros: members, activeGroup: active?.grupo || null, activeRole: active?.perfil || null };
}

async function createDefaults(groupId: string) {
  const db = requireDb();
  const courts = Array.from({ length: 4 }, (_, i) => ({ grupo_id: groupId, nome: `Quadra ${i + 1}`, numero: i + 1, ativa: true }));
  const hours = DEFAULT_HORARIOS_PADRAO.map((h) => ({
    grupo_id: groupId, hora_inicio: h.inicio, hora_fim: h.fim,
    turno: Number(h.inicio.slice(0, 2)) < 12 ? 'manha' : Number(h.inicio.slice(0, 2)) < 18 ? 'tarde' : 'noite', ativo: true
  }));
  const courtResult = await db.from('quadras').insert(courts);
  if (courtResult.error) fail('Erro ao criar quadras padrão', courtResult.error);
  const hourResult = await db.from('horarios').insert(hours);
  if (hourResult.error) fail('Erro ao criar horários padrão', hourResult.error);
}

async function createGroup(userId: string, nome: string, cidade = '', estado = '', codigo: string | null = null): Promise<Grupo> {
  const db = requireDb();
  const norm = normalizeLocation(cidade, estado);
  const descricao = [norm.cidade, norm.estado].filter(Boolean).join(' - ') || null;

  // Chamada exclusiva da RPC public.criar_grupo_com_proprietario
  const { data: rpcRes, error: rpcErr } = await db.rpc('criar_grupo_com_proprietario', {
    p_nome: nome.trim(),
    p_descricao: descricao,
    p_codigo: codigo ? codigo.trim() : null
  });

  if (rpcErr || !rpcRes) {
    console.error('[Supabase RPC criar_grupo_com_proprietario Error]:', rpcErr?.code, rpcErr?.message, rpcErr);
    fail('Erro ao criar grupo no Supabase: ' + (rpcErr?.message || 'Resposta vazia da RPC'), rpcErr);
  }

  const createdGroupId = typeof rpcRes === 'object' && rpcRes !== null && 'id' in rpcRes ? (rpcRes as any).id : rpcRes;

  // Após criar, carregar o registro oficial de public.grupos
  const { data: groupRow, error: fetchErr } = await db
    .from('grupos')
    .select('*')
    .eq('id', createdGroupId)
    .single();

  if (fetchErr || !groupRow) {
    console.error('[Supabase Fetch Grupo Error]:', fetchErr?.code, fetchErr?.message, fetchErr);
    fail('Erro ao carregar grupo criado de public.grupos', fetchErr || 'Grupo não encontrado');
  }

  await createDefaults(groupRow.id);

  return mapGroup(groupRow);
}

let onboardingLockPromise: Promise<void> | null = null;

async function completePendingOnboarding(user: any): Promise<void> {
  if (onboardingLockPromise) {
    await onboardingLockPromise;
    return;
  }

  let resolveLock: () => void = () => {};
  onboardingLockPromise = new Promise((resolve) => { resolveLock = resolve; });

  try {
    const db = requireDb();
    
    // 1. Consultar se o usuário já possui vínculo ativo ou pendente em membros_grupo
    const { count, error: countError } = await db
      .from('membros_grupo')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', user.id);

    if (countError) {
      console.error('[Supabase Onboarding membros_grupo Check Error]:', countError.code, countError.message, countError);
    }

    // Se já existir vínculo em membros_grupo, NÃO cria outro grupo nem chama a RPC novamente!
    if (count && count > 0) {
      return;
    }

    // 2. Verificar se há intenção de criação de grupo preservada em user_metadata
    const meta = user.user_metadata || {};
    const onboardingRole = meta.onboarding_role || meta.cadastro_type;

    if (onboardingRole === 'proprietario' && meta.nome_grupo) {
      console.log('[Onboarding] Sessão autenticada confirmada. Executando RPC criar_grupo_com_proprietario para:', meta.nome_grupo);
      
      await createGroup(user.id, meta.nome_grupo, meta.cidade || '', meta.estado || '');

      // 3. Limpar intenção pendente de user_metadata no Supabase Auth após o sucesso da RPC
      const { error: updateMetaErr } = await db.auth.updateUser({
        data: {
          onboarding_role: null,
          cadastro_type: null,
          nome_grupo: null,
          cidade: null,
          estado: null,
        }
      });

      if (updateMetaErr) {
        console.warn('[Supabase Metadata Cleanup Warning]:', updateMetaErr.message);
      }
    } else if (onboardingRole === 'jogador' && meta.codigo_grupo) {
      const code = String(meta.codigo_grupo).trim().toUpperCase();
      console.log('[Onboarding] Sessão autenticada confirmada. Executando RPC entrar_grupo_por_codigo para:', code);
      
      const { data: rpcRes, error: rpcErr } = await db.rpc('entrar_grupo_por_codigo', { p_codigo: code });

      if (rpcErr) {
        console.error('[Supabase entrar_grupo_por_codigo Error]:', rpcErr.code, rpcErr.message, rpcErr);
      } else if (rpcRes && rpcRes.success) {
        await db.auth.updateUser({
          data: {
            onboarding_role: null,
            cadastro_type: null,
            codigo_grupo: null,
          }
        });
      }
    }
  } catch (err: any) {
    console.error('[Onboarding Complete Exception]:', err.message || err);
  } finally {
    onboardingLockPromise = null;
    resolveLock();
  }
}

async function mapReservation(row: any): Promise<Reserva> {
  const start = row.horario?.hora_inicio ? timeText(row.horario.hora_inicio) : '';
  const end = row.horario?.hora_fim ? timeText(row.horario.hora_fim) : '';
  return {
    id: row.id,
    grupo_id: row.grupo_id,
    data: row.data,
    horario_id: row.horario_id,
    horario_label: start && end ? `${start} às ${end}` : '',
    quadra_id: row.quadra_id || row.quadra?.id,
    quadra_numero: row.quadra?.numero || row.quadra_numero || 0,
    jogador_id: row.criador_id,
    jogador_nome: row.criador?.nome || '',
    jogador_classe: classFromDb(row.criador_classe),
    created_at: row.criado_em
  };
}

export const DbService = {
  loadSession(userId: string): Promise<AuthSession> { return loadSession(userId); },
  saveCurrentSession(_session: AuthSession | null): void {},
  getCurrentSession(): AuthSession | null { return null; },

  async restoreSession(): Promise<AuthSession | null> {
    const db = getSupabaseClient();
    if (!db) return null;

    const { data, error } = await db.auth.getSession();
    if (error) {
      console.error('[Supabase getSession Error]:', error.code, error.message, error);
      fail('Erro ao recuperar sessão', error);
    }

    if (!data.session?.user) return null;

    // Aguarda e executa eventual cadastro pendente em user_metadata assim que houver sessão válida
    await completePendingOnboarding(data.session.user);

    return loadSession(data.session.user.id);
  },

  async registerProprietario(data: CadastroProprietarioData): Promise<{
    session: AuthSession | null;
    requiresEmailConfirmation: boolean;
    message?: string;
  }> {
    const db = requireDb();
    const { data: auth, error } = await db.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.senha,
      options: {
        data: {
          nome: data.nome.trim(),
          whatsapp: data.whatsapp.trim(),
          onboarding_role: 'proprietario',
          cadastro_type: 'proprietario',
          nome_grupo: data.nomeGrupo.trim(),
          cidade: data.cidade.trim(),
          estado: data.estado.trim()
        }
      }
    });

    if (error) {
      console.error('[Supabase signUp Proprietário Error]:', error.code, error.message, error);
      fail(error.message || 'Erro ao realizar cadastro do proprietário', error);
    }

    if (!auth.user) {
      fail('Usuário não criado. Tente novamente.');
    }

    // Se o Supabase exigir confirmação de e-mail (session == null), orienta o usuário e preserva intenção no metadata
    if (!auth.session) {
      return {
        session: null,
        requiresEmailConfirmation: true,
        message: 'Cadastro realizado. Confirme seu e-mail para continuar a criação do grupo.'
      };
    }

    // Se a sessão já estiver ativa (e-mail auto-confirmado), conclui onboarding e carrega a sessão
    await completePendingOnboarding(auth.user);
    const session = await loadSession(auth.user.id);
    return { session, requiresEmailConfirmation: false };
  },

  async registerJogador(data: CadastroJogadorData): Promise<{
    session: AuthSession | null;
    requiresEmailConfirmation: boolean;
    message?: string;
  }> {
    const db = requireDb();
    const code = (data.codigoGrupo || '').trim().toUpperCase();

    const { data: auth, error } = await db.auth.signUp({
      email: data.email.trim().toLowerCase(),
      password: data.senha,
      options: {
        data: {
          nome: data.nome.trim(),
          whatsapp: data.whatsapp.trim(),
          onboarding_role: 'jogador',
          cadastro_type: 'jogador',
          codigo_grupo: code
        }
      }
    });

    if (error) {
      console.error('[Supabase signUp Jogador Error]:', error.code, error.message, error);
      fail(error.message || 'Erro ao realizar cadastro do jogador', error);
    }

    if (!auth.user) {
      fail('Usuário não criado. Tente novamente.');
    }

    if (!auth.session) {
      return {
        session: null,
        requiresEmailConfirmation: true,
        message: 'Cadastro realizado. Confirme seu e-mail para solicitar acesso ao grupo.'
      };
    }

    await completePendingOnboarding(auth.user);
    const session = await loadSession(auth.user.id);
    return { session, requiresEmailConfirmation: false };
  },

  async login(email: string, senha: string): Promise<AuthSession> {
    const db = requireDb();
    const { data, error } = await db.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: senha
    });

    if (error) {
      console.error('[Supabase signInWithPassword Error]:', error.code, error.message, error);
      if (error.message?.includes('Email not confirmed') || error.code === 'email_not_confirmed') {
        fail('E-mail não confirmado. Verifique sua caixa de entrada para confirmar seu e-mail e ative sua conta.');
      }
      fail('E-mail ou senha incorretos.', error);
    }

    if (!data.user) fail('Usuário não encontrado.');

    await completePendingOnboarding(data.user);

    return loadSession(data.user.id);
  },

  async switchGroup(userId: string, groupId: string): Promise<AuthSession> {
    const session = await loadSession(userId);
    const member = session.membros.find((m) => m.grupo_id === groupId);
    if (!member?.grupo) throw new Error('Você não pertence a este grupo.');
    return { ...session, activeGroup: member.grupo, activeRole: member.perfil };
  },

  async getGroupMembers(groupId: string): Promise<MembroGrupo[]> {
    const { data, error } = await requireDb().from('membros_grupo').select('*, usuario:usuarios(*)').eq('grupo_id', groupId).order('criado_em');
    if (error) fail('Erro ao carregar membros', error);
    return (data || []).map(mapMember);
  },

  async updateMemberStatus(memberId: string, value: MemberStatus): Promise<MembroGrupo[]> {
    const db = requireDb();
    const { data: current, error: findError } = await db.from('membros_grupo').select('grupo_id').eq('id', memberId).single();
    if (findError) fail('Membro não encontrado', findError);
    const { error } = await db.from('membros_grupo').update({ status: statusToDb(value) }).eq('id', memberId);
    if (error) fail('Erro ao atualizar status', error);
    return this.getGroupMembers(current.grupo_id);
  },

  async updateMemberPerfil(memberId: string, value: PerfilRole): Promise<MembroGrupo[]> {
    const db = requireDb();
    const { data: current, error: findError } = await db.from('membros_grupo').select('grupo_id').eq('id', memberId).single();
    if (findError) fail('Membro não encontrado', findError);
    const { error } = await db.from('membros_grupo').update({ papel: roleToDb(value) }).eq('id', memberId);
    if (error) fail('Erro ao atualizar papel', error);
    return this.getGroupMembers(current.grupo_id);
  },

  async updateMemberClass(memberId: string, value: PlayerClass, groupId?: string): Promise<MembroGrupo[]> {
    const db = requireDb();
    let targetGroupId = groupId;
    if (!targetGroupId) {
      const { data: current, error: findError } = await db
        .from('membros_grupo')
        .select('grupo_id')
        .eq('id', memberId)
        .single();
      if (findError || !current) fail('Membro não encontrado', findError);
      targetGroupId = current.grupo_id;
    }

    const dbClass = classToDb(value);

    // Invocar exclusivamente a RPC segura no Supabase
    const { error: rpcErr } = await db.rpc('alterar_classe_jogador', {
      p_membro_id: memberId,
      p_grupo_id: targetGroupId,
      p_nova_classe: dbClass || 'Sem Classe'
    });

    if (rpcErr) {
      console.error('[Supabase RPC alterar_classe_jogador Error]:', rpcErr.code, rpcErr.message, rpcErr);
      fail(rpcErr.message || 'Erro ao alterar classe do jogador. Apenas o proprietário tem permissão.', rpcErr);
    }

    return this.getGroupMembers(targetGroupId!);
  },


  async approveMemberWithClass(memberId: string, value: PlayerClass): Promise<MembroGrupo[]> {
    const db = requireDb();
    const { data: current, error: findError } = await db.from('membros_grupo').select('grupo_id').eq('id', memberId).single();
    if (findError) fail('Membro não encontrado', findError);
    const { error } = await db.from('membros_grupo').update({ status: 'ativo', classe: classToDb(value) }).eq('id', memberId);
    if (error) fail('Erro ao aprovar jogador', error);
    return this.getGroupMembers(current.grupo_id);
  },

  async cancelMembershipRequest(memberId: string, userId: string): Promise<AuthSession> {
    const db = requireDb();
    const { error } = await db.from('membros_grupo').delete().eq('id', memberId).eq('usuario_id', userId);
    if (error) {
      console.error('[Supabase Delete Membro Error]:', error.code, error.message, error);
      fail('Erro ao cancelar solicitação', error);
    }
    return loadSession(userId);
  },

  async updateGroupInfo(groupId: string, values: Partial<Grupo>): Promise<Grupo> {
    const payload: Record<string, unknown> = {};
    if (values.nome !== undefined) payload.nome = values.nome;
    if (values.logo_url !== undefined) payload.logo_url = values.logo_url;
    if (values.imagem_path !== undefined) payload.imagem_path = values.imagem_path;
    if (values.ativo !== undefined) payload.ativo = values.ativo;
    if (values.cidade !== undefined || values.estado !== undefined) {
      const norm = normalizeLocation(values.cidade, values.estado);
      payload.descricao = [norm.cidade, norm.estado].filter(Boolean).join(' - ');
    }
    const { data, error } = await requireDb().from('grupos').update(payload).eq('id', groupId).select().single();
    if (error) fail('Erro ao atualizar grupo', error);
    return mapGroup(data);
  },

  getGroupClasses(groupId: string): PlayerClass[] {
    try {
      const raw = localStorage.getItem(`tennisplay_classes_${groupId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as PlayerClass[];
      }
    } catch (e) {
      console.warn('Erro ao carregar classes do grupo:', e);
    }
    return DEFAULT_PLAYER_CLASSES;
  },

  saveGroupClasses(groupId: string, classes: PlayerClass[]): void {
    try {
      localStorage.setItem(`tennisplay_classes_${groupId}`, JSON.stringify(classes));
    } catch (e) {
      console.warn('Erro ao salvar classes do grupo:', e);
    }
  },

  async updateUserProfile(userId: string, values: Partial<Usuario>): Promise<Usuario> {
    const payload: Record<string, unknown> = {};
    if (values.nome !== undefined) payload.nome = values.nome;
    if (values.whatsapp !== undefined) payload.whatsapp = values.whatsapp;
    if (values.foto_url !== undefined) payload.avatar_url = values.foto_url;
    const { data, error } = await requireDb().from('usuarios').update(payload).eq('id', userId).select().single();
    if (error) fail('Erro ao atualizar perfil', error);
    return mapUser(data);
  },

  async joinGroupByCode(userId: string, rawCode: string): Promise<{ group: Grupo; member: MembroGrupo }> {
    const db = requireDb();
    const code = rawCode.trim().toUpperCase();
    const { data: rpcRes, error: rpcErr } = await db.rpc('entrar_grupo_por_codigo', { p_codigo: code });
    if (rpcErr || !rpcRes || !rpcRes.success) {
      fail('Código do grupo não encontrado ou erro ao solicitar entrada', rpcErr || rpcRes?.mensagem || code);
    }
    const groupId = rpcRes.grupo_id;
    const { data: group, error: groupError } = await db.from('grupos').select('*').eq('id', groupId).single();
    if (groupError || !group) fail('Erro ao carregar dados do grupo', groupError);
    const { data: member, error: memberError } = await db.from('membros_grupo').select('*, grupo:grupos(*)').eq('grupo_id', groupId).eq('usuario_id', userId).single();
    if (memberError || !member) fail('Erro ao carregar status da solicitação', memberError);
    return { group: mapGroup(group), member: mapMember(member) };
  },

  async createNewGroup(userId: string, data: { nome: string; cidade: string; estado: string }): Promise<AuthSession> {
    await createGroup(userId, data.nome, data.cidade, data.estado);
    return loadSession(userId);
  },

  async getAllGroups(): Promise<Grupo[]> {
    const { data, error } = await requireDb().from('grupos').select('*').eq('ativo', true);
    if (error) fail('Erro ao carregar grupos', error);
    return (data || []).map(mapGroup);
  },

  async getGroupsForUser(userId: string): Promise<{ group: Grupo; member: MembroGrupo }[]> {
    const { data, error } = await requireDb().from('membros_grupo').select('*, grupo:grupos(*)').eq('usuario_id', userId);
    if (error) fail('Erro ao carregar grupos do usuário', error);
    return (data || []).filter((row: any) => row.grupo).map((row: any) => ({ group: mapGroup(row.grupo), member: mapMember(row) }));
  },

  async getGroupCourtConfig(groupId: string, _date: string): Promise<CourtConfig> {
    const db = requireDb();
    let [{ data: courts, error: courtError }, { data: hours, error: hourError }] = await Promise.all([
      db.from('quadras').select('*').eq('grupo_id', groupId).eq('ativa', true).order('numero'),
      db.from('horarios').select('*').eq('grupo_id', groupId).eq('ativo', true).order('hora_inicio')
    ]);
    if (courtError) fail('Erro ao carregar quadras', courtError);
    if (hourError) fail('Erro ao carregar horários', hourError);

    // Se o grupo ainda não tiver quadras ou horários gravados na base, garante os 4 padrões e horários
    if (!courts || courts.length === 0 || !hours || hours.length === 0) {
      try {
        if (!courts || courts.length === 0) {
          const defaultCourts = Array.from({ length: 4 }, (_, i) => ({
            grupo_id: groupId,
            nome: `Quadra ${i + 1}`,
            numero: i + 1,
            ativa: true
          }));
          await db.from('quadras').insert(defaultCourts);
        }
        if (!hours || hours.length === 0) {
          const defaultHours = DEFAULT_HORARIOS_PADRAO.map((h) => ({
            grupo_id: groupId,
            hora_inicio: h.inicio,
            hora_fim: h.fim,
            turno: Number(h.inicio.slice(0, 2)) < 12 ? 'manha' : Number(h.inicio.slice(0, 2)) < 18 ? 'tarde' : 'noite',
            ativo: true
          }));
          await db.from('horarios').insert(defaultHours);
        }

        const [reCourts, reHours] = await Promise.all([
          db.from('quadras').select('*').eq('grupo_id', groupId).eq('ativa', true).order('numero'),
          db.from('horarios').select('*').eq('grupo_id', groupId).eq('ativo', true).order('hora_inicio')
        ]);
        if (reCourts.data && reCourts.data.length > 0) courts = reCourts.data;
        if (reHours.data && reHours.data.length > 0) hours = reHours.data;
      } catch (err) {
        console.warn('Auto-criação de quadras/horários padrão:', err);
      }
    }

    const courtList: Quadra[] = (courts || []).map((c: any) => ({
      id: c.id,
      grupo_id: c.grupo_id,
      numero: c.numero,
      nome: c.nome || `Quadra ${c.numero}`,
      ativa: c.ativa !== false,
      dias_funcionamento: c.dias_funcionamento || [0, 1, 2, 3, 4, 5, 6]
    }));

    const slots: TimeSlot[] = (hours || []).map((h: any) => ({
      id: h.id,
      inicio: timeText(h.hora_inicio),
      fim: timeText(h.hora_fim),
      label: `${timeText(h.hora_inicio)} às ${timeText(h.hora_fim)}`
    }));
    return {
      grupo_id: groupId,
      data: _date,
      qtd_quadras: courtList.length > 0 ? courtList.length : 4,
      quadras: courtList.length > 0 ? courtList : [
        { id: 'q1', grupo_id: groupId, numero: 1, nome: 'Quadra 1', ativa: true, dias_funcionamento: [0, 1, 2, 3, 4, 5, 6] },
        { id: 'q2', grupo_id: groupId, numero: 2, nome: 'Quadra 2', ativa: true, dias_funcionamento: [0, 1, 2, 3, 4, 5, 6] },
        { id: 'q3', grupo_id: groupId, numero: 3, nome: 'Quadra 3', ativa: true, dias_funcionamento: [0, 1, 2, 3, 4, 5, 6] },
        { id: 'q4', grupo_id: groupId, numero: 4, nome: 'Quadra 4', ativa: true, dias_funcionamento: [0, 1, 2, 3, 4, 5, 6] }
      ],
      horarios: slots.length > 0 ? slots : DEFAULT_HORARIOS_PADRAO,
      prazo_cancelamento_horas: 2
    };
  },

  async saveGroupCourtConfig(groupId: string, date: string, quantity: number, slots: TimeSlot[] = DEFAULT_HORARIOS_PADRAO, deadline = 2): Promise<CourtConfig> {
    const db = requireDb();
    const { data: existing, error: existingError } = await db.from('quadras').select('*').eq('grupo_id', groupId).order('numero');
    if (existingError) fail('Erro ao carregar quadras', existingError);
    for (let number = 1; number <= Math.max(quantity, existing?.length || 0); number++) {
      const court = existing?.find((item: any) => item.numero === number);
      if (court) {
        const { error } = await db.from('quadras').update({ ativa: number <= quantity, nome: `Quadra ${number}` }).eq('id', court.id);
        if (error) fail('Erro ao atualizar quadra', error);
      } else if (number <= quantity) {
        const { error } = await db.from('quadras').insert({ grupo_id: groupId, numero: number, nome: `Quadra ${number}`, ativa: true });
        if (error) fail('Erro ao criar quadra', error);
      }
    }
    const { data: oldHours, error: oldHoursError } = await db.from('horarios').select('*').eq('grupo_id', groupId);
    if (oldHoursError) fail('Erro ao carregar horários', oldHoursError);
    const wanted = new Set(slots.map((slot) => `${slot.inicio}-${slot.fim}`));
    for (const old of oldHours || []) {
      const { error } = await db.from('horarios').update({ ativo: wanted.has(`${timeText(old.hora_inicio)}-${timeText(old.hora_fim)}`) }).eq('id', old.id);
      if (error) fail('Erro ao atualizar horário', error);
    }
    for (const slot of slots) {
      const found = (oldHours || []).some((old: any) => timeText(old.hora_inicio) === slot.inicio && timeText(old.hora_fim) === slot.fim);
      if (!found) {
        const hour = Number(slot.inicio.slice(0, 2));
        const { error } = await db.from('horarios').insert({ grupo_id: groupId, hora_inicio: slot.inicio, hora_fim: slot.fim, turno: hour < 12 ? 'manha' : hour < 18 ? 'tarde' : 'noite', ativo: true });
        if (error) fail('Erro ao criar horário', error);
      }
    }
    return this.getGroupCourtConfig(groupId, date).then((config) => ({ ...config, prazo_cancelamento_horas: deadline }));
  },

  async getBookingsForDate(groupId: string, date: string): Promise<Reserva[]> {
    const { data, error } = await requireDb()
      .from('reservas')
      .select('*, quadra:quadras(id, numero, nome), horario:horarios(id, hora_inicio, hora_fim), criador:usuarios!reservas_criador_id_fkey(id, nome), adversario:usuarios!reservas_adversario_id_fkey(id, nome)')
      .eq('grupo_id', groupId)
      .eq('data', date)
      .in('status', ['aguardando', 'confirmada']);
    if (error) {
      console.error('Erro ao sincronizar reservas:', error);
      fail('Erro ao sincronizar reservas', error);
    }
    return Promise.all((data || []).map(mapReservation));
  },

  async createBooking(input: {
    grupo_id: string;
    data: string;
    horario_id: string;
    horario_label: string;
    quadra_numero: number;
    quadra_id?: string;
    jogador_id?: string;
    jogador_nome?: string;
    jogador_classe?: PlayerClass;
  }): Promise<Reserva> {
    const db = requireDb();

    // 1. Validar a sessão atual no Supabase Auth
    const {
      data: { session },
      error: sessionError
    } = await db.auth.getSession();

    console.log("AUTH DEBUG", {
      possuiSessao: !!session,
      userId: session?.user?.id
    });

    if (sessionError || !session?.user) {
      console.error('[Supabase Auth Session Error]:', sessionError);
      throw new Error('Sua sessão expirou. Entre novamente.');
    }

    const user = session.user;

    // Extrair horários inicial e final do label caso disponíveis
    let inicio = '';
    let fim = '';
    if (input.horario_label && input.horario_label.includes('às')) {
      const parts = input.horario_label.split('às').map((s) => s.trim());
      inicio = parts[0] || '';
      fim = parts[1] || '';
    }

    // Regra de Negócio: Bloquear reservas em datas ou horários passados
    const todayStr = getTodayCivilDate();
    const dataNormalizada = formatCivilDate(input.data);
    if (dataNormalizada < todayStr) {
      throw new Error('Não é possível reservar horários em datas anteriores.');
    }
    if (dataNormalizada === todayStr && inicio && isPastTimeSlot(dataNormalizada, inicio)) {
      throw new Error('Este horário já começou e não pode mais ser reservado.');
    }

    const isCourtUuid = !!(input.quadra_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.quadra_id));

    // Log de diagnóstico obrigatório
    console.log("CREATE BOOKING PARAMS:", {
      grupoId: input.grupo_id,
      quadraId: input.quadra_id,
      quadraNumero: input.quadra_numero,
      data: input.data,
      horarioId: input.horario_id,
      jogadorId: user.id
    });

    // 2. Tentar via RPC public.criar_reserva (Atômica, Concorrente e Segura)
    console.log("CREATE BOOKING: tentando RPC");
    let isRpcUnavailable = false;

    try {
      let rpcData: any = null;
      let rpcError: any = null;

      // Tentativa 1: RPC com assinatura canônica (incluindo p_quadra_id)
      const rpcResult1 = await db.rpc('criar_reserva', {
        p_grupo_id: input.grupo_id,
        p_data: input.data,
        p_quadra_numero: input.quadra_numero,
        p_horario_id: input.horario_id,
        p_horario_inicio: inicio ? (inicio.length === 5 ? `${inicio}:00` : inicio) : null,
        p_horario_fim: fim ? (fim.length === 5 ? `${fim}:00` : fim) : null,
        p_quadra_id: isCourtUuid ? input.quadra_id : null
      });

      rpcData = rpcResult1.data;
      rpcError = rpcResult1.error;

      // Se a assinatura com p_quadra_id não existir no catálogo remoto (código PGRST202 ou 42883), tenta a assinatura legada de 6 parâmetros
      if (rpcError && (rpcError.code === 'PGRST202' || rpcError.code === '42883' || String(rpcError.message).includes('Could not find the function'))) {
        console.warn('RPC com p_quadra_id não encontrada no schema cache remoto. Tentando assinatura legada...');
        const rpcResult2 = await db.rpc('criar_reserva', {
          p_grupo_id: input.grupo_id,
          p_data: input.data,
          p_quadra_numero: input.quadra_numero,
          p_horario_id: input.horario_id,
          p_horario_inicio: inicio ? (inicio.length === 5 ? `${inicio}:00` : inicio) : null,
          p_horario_fim: fim ? (fim.length === 5 ? `${fim}:00` : fim) : null
        });
        if (rpcResult2.data) {
          rpcData = rpcResult2.data;
          rpcError = null;
        } else if (rpcResult2.error) {
          rpcError = rpcResult2.error;
        }
      }

      if (!rpcError && rpcData) {
        console.log("CREATE BOOKING: sucesso via RPC", rpcData);
        return {
          id: rpcData.id,
          grupo_id: rpcData.grupo_id,
          data: rpcData.data,
          horario_id: rpcData.horario_id,
          horario_label: rpcData.horario_label || input.horario_label,
          quadra_id: rpcData.quadra_id || input.quadra_id,
          quadra_numero: rpcData.quadra_numero || input.quadra_numero,
          jogador_id: rpcData.jogador_id || user.id,
          jogador_nome: rpcData.jogador_nome || input.jogador_nome || user.user_metadata?.nome || 'Jogador',
          jogador_classe: classFromDb(rpcData.jogador_classe),
          created_at: rpcData.created_at || new Date().toISOString()
        };
      }

      if (rpcError) {
        console.log("CREATE BOOKING - resultado da RPC (com erro):", rpcError);
        const msg = String(rpcError.message || '');
        const code = String(rpcError.code || '');

        // Detectar se a RPC não está provisionada no banco remoto
        if (code === '42883' || code === 'PGRST202' || msg.includes('function public.criar_reserva') || msg.includes('Could not find the function')) {
          console.warn('RPC public.criar_reserva não provisionada no Supabase remoto. Acionando fallback direto...');
          isRpcUnavailable = true;
        } else {
          // Erros de negócio da RPC
          console.error("CREATE BOOKING - ERRO ORIGINAL:", rpcError);
          if (code === '23505' || msg.includes('acabou de ser reservado') || msg.includes('unique constraint') || msg.includes('duplicate key')) {
            throw new Error('Este horário acabou de ser reservado por outro jogador. Escolha outro horário.');
          }
          if (msg.includes('Sua sessão expirou') || msg.includes('JWT') || msg.includes('session')) {
            throw new Error('Sua sessão expirou. Entre novamente.');
          }
          if (msg.includes('não está vinculado a este grupo')) {
            throw new Error('Seu cadastro ainda não está vinculado a este grupo.');
          }
          if (msg.includes('aguardando aprovação') || msg.includes('pendente')) {
            throw new Error('Seu acesso ao grupo ainda está aguardando aprovação.');
          }
          if (msg.includes('classe ainda não foi definida')) {
            throw new Error('Sua classe ainda não foi definida pelo proprietário.');
          }
          if (code === '42501' || msg.includes('permission') || msg.includes('policy')) {
            throw new Error('Você não tem permissão para reservar neste grupo.');
          }
          if (msg === 'Failed to fetch' || msg.includes('Failed to fetch')) {
            throw new Error('Não foi possível conectar ao servidor. Verifique sua internet.');
          }
          throw new Error(msg || 'Não foi possível concluir a reserva. Tente novamente.');
        }
      }
    } catch (rpcErr: any) {
      const msg = String(rpcErr?.message || '');
      const code = String(rpcErr?.code || '');
      if (
        code === '42883' ||
        code === 'PGRST202' ||
        msg.includes('function public.criar_reserva') ||
        msg.includes('Could not find the function')
      ) {
        isRpcUnavailable = true;
      } else {
        throw rpcErr;
      }
    }

    // 3. Fallback Direto Seguro no Supabase Client
    console.log("CREATE BOOKING: executando fallback direto");

    // 3.1 Localizar o membro do grupo usando o usuário autenticado
    const { data: membro, error: membroError } = await db
      .from('membros_grupo')
      .select('id, grupo_id, usuario_id, status, classe')
      .eq('usuario_id', user.id)
      .eq('grupo_id', input.grupo_id)
      .maybeSingle();

    if (membroError) {
      console.error('CREATE BOOKING - ERRO AO CONSULTAR MEMBRO:', {
        message: membroError.message,
        code: membroError.code,
        details: membroError.details,
        hint: membroError.hint,
        usuario_id: user.id,
        grupo_id: input.grupo_id
      });
      throw new Error(membroError.message || 'Não foi possível verificar seu cadastro.');
    }

    if (!membro) {
      throw new Error('Seu cadastro ainda não está vinculado a este grupo.');
    }

    if (membro.status === 'pendente') {
      throw new Error('Seu acesso ao grupo ainda está aguardando aprovação.');
    }

    if (membro.status !== 'ativo') {
      throw new Error('Seu cadastro não está ativo neste grupo.');
    }

    // 3.2 Validar e obter quadra_id real (UUID)
    let court: { id: string; numero: number; ativa: boolean } | null = null;
    if (isCourtUuid) {
      const { data: foundCourt } = await db
        .from('quadras')
        .select('id, numero, ativa')
        .eq('id', input.quadra_id)
        .eq('grupo_id', input.grupo_id)
        .maybeSingle();
      if (foundCourt) court = foundCourt;
    }

    if (!court) {
      const { data: foundByNum } = await db
        .from('quadras')
        .select('id, numero, ativa')
        .eq('grupo_id', input.grupo_id)
        .eq('numero', input.quadra_numero)
        .maybeSingle();

      if (foundByNum) {
        court = foundByNum;
      }
    }

    if (!court) {
      // Se não encontrou no banco, busca qualquer quadra ativa do grupo como referência
      const { data: anyCourt } = await db
        .from('quadras')
        .select('id, numero, ativa')
        .eq('grupo_id', input.grupo_id)
        .limit(1)
        .maybeSingle();
      if (anyCourt) court = anyCourt;
    }

    if (!court) {
      throw new Error(`A Quadra ${input.quadra_numero} não está cadastrada neste clube.`);
    }

    if (court.ativa === false) {
      throw new Error(`A Quadra ${court.numero} está inativa no momento.`);
    }

    // 3.3 Validar e obter horario_id real (UUID)
    let hour: { id: string } | null = null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.horario_id);

    if (isUuid) {
      const { data: foundHour } = await db
        .from('horarios')
        .select('id')
        .eq('id', input.horario_id)
        .eq('grupo_id', input.grupo_id)
        .eq('ativo', true)
        .maybeSingle();

      if (foundHour) {
        hour = foundHour;
      }
    }

    if (!hour && inicio && fim) {
      const inicioFormatted = inicio.length === 5 ? `${inicio}:00` : inicio;
      const fimFormatted = fim.length === 5 ? `${fim}:00` : fim;

      const { data: foundByTime } = await db
        .from('horarios')
        .select('id')
        .eq('grupo_id', input.grupo_id)
        .or(`hora_inicio.eq.${inicio},hora_inicio.eq.${inicioFormatted}`)
        .eq('ativo', true)
        .maybeSingle();

      if (foundByTime) {
        hour = foundByTime;
      }
    }

    if (!hour) {
      throw new Error('Este horário não está mais disponível.');
    }

    // 3.4 Validar dados da reserva e montar payload
    if (dataNormalizada < todayStr) {
      throw new Error('Não é possível reservar horários em datas anteriores.');
    }
    if (dataNormalizada === todayStr && inicio && isPastTimeSlot(dataNormalizada, inicio)) {
      throw new Error('Este horário já começou e não pode mais ser reservado.');
    }

    const payload = {
      grupo_id: input.grupo_id,
      quadra_id: court.id,
      horario_id: hour.id,
      data: input.data,
      criador_id: user.id,
      criador_classe: classToDb(membro.classe) || null,
      nome_convidado: 'Adversário a definir',
      status: 'confirmada'
    };

    console.log("CREATE BOOKING: executando INSERT com payload:", payload);

    // 3.5 Gravar no Supabase
    const { data, error: reservaError } = await db
      .from('reservas')
      .insert(payload)
      .select('*, quadra:quadras(id, numero, nome), horario:horarios(id, hora_inicio, hora_fim), criador:usuarios!reservas_criador_id_fkey(id, nome), adversario:usuarios!reservas_adversario_id_fkey(id, nome)')
      .single();

    if (reservaError || !data) {
      console.error("CREATE BOOKING - ERRO ORIGINAL:", reservaError);

      const msg = String((reservaError as any)?.message || '');
      const code = String((reservaError as any)?.code || '');

      if (code === '23505' || msg.includes('unique constraint') || msg.includes('duplicate key') || msg.includes('reservation_no_double_booking')) {
        throw new Error('Este horário acabou de ser reservado por outro jogador. Escolha outro horário.');
      }

      if (code === '42501' || msg.includes('row-level security') || msg.includes('permission') || msg.includes('policy')) {
        throw new Error('Você não tem permissão para reservar neste grupo.');
      }

      if (code === '23503' || msg.includes('foreign key constraint')) {
        throw new Error('Erro de integridade de dados ao vincular quadra ou horário.');
      }

      if (msg.includes('JWT') || msg.includes('session') || msg.includes('token') || msg.includes('Auth session missing')) {
        throw new Error('Sua sessão expirou. Entre novamente.');
      }

      if (msg === 'Failed to fetch' || msg.includes('Failed to fetch')) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua internet.');
      }

      throw new Error(msg || 'Não foi possível concluir a reserva. Tente novamente.');
    }

    console.log("CREATE BOOKING: resultado do INSERT (sucesso):", data);
    return mapReservation(data);
  },

  async cancelBooking(id: string, userId: string, role: PerfilRole): Promise<void> {
    const db = requireDb();

    // 1. Log temporário de diagnóstico
    console.log('CANCELAMENTO DEBUG', {
      id,
      userId,
      role
    });

    // 2. Tentar via RPC public.cancelar_reserva se disponível no Supabase
    console.log("CANCELAMENTO: tentando RPC cancelar_reserva");
    try {
      const { data: rpcData, error: rpcError } = await db.rpc('cancelar_reserva', {
        p_reserva_id: id
      });

      console.log("CANCELAMENTO: resultado RPC", {
        data: rpcData,
        error: rpcError
      });

      if (!rpcError) {
        // Confirmar no banco se a reserva foi realmente alterada para cancelada
        const { data: checkReserva } = await db
          .from('reservas')
          .select('id, status, cancelado_por, cancelado_em')
          .eq('id', id)
          .maybeSingle();

        if (checkReserva && checkReserva.status === 'cancelada') {
          console.log("CANCELAMENTO: confirmado via RPC e verificação de banco", checkReserva);
          return;
        }
      }

      if (rpcError) {
        const msg = String(rpcError.message || '');
        const code = String(rpcError.code || '');

        if (code === '42883' || code === 'PGRST202' || msg.includes('function public.cancelar_reserva') || msg.includes('Could not find the function')) {
          console.log("RPC cancelar_reserva NÃO EXISTE no banco remoto.");
        } else {
          console.error('ERRO CANCELAR RESERVA (RPC):', rpcError);
          if (msg.includes('permissão') || msg.includes('permission') || code === '42501') {
            throw new Error('Você não tem permissão para cancelar esta reserva.');
          }
          if (msg.includes('Sua sessão expirou') || msg.includes('JWT') || msg.includes('session')) {
            throw new Error('Sua sessão expirou. Entre novamente.');
          }
          throw new Error(msg || 'Não foi possível cancelar esta reserva.');
        }
      }
    } catch (rpcErr: any) {
      const msg = String(rpcErr?.message || '');
      const code = String(rpcErr?.code || '');
      if (code === '42883' || code === 'PGRST202' || msg.includes('function public.cancelar_reserva') || msg.includes('Could not find the function')) {
        console.log("RPC cancelar_reserva NÃO EXISTE no banco remoto.");
      } else {
        throw rpcErr;
      }
    }

    // 3. Fallback: Consulta e validação prévia de permissão do usuário
    console.log("CANCELAMENTO: executando UPDATE direto");
    const { data: bookingBefore, error: bookingBeforeError } = await db
      .from('reservas')
      .select('id, grupo_id, criador_id, status, cancelado_por, cancelado_em')
      .eq('id', id)
      .maybeSingle();

    console.log("RESERVA ANTES DO CANCELAMENTO", bookingBefore);

    if (bookingBeforeError) {
      console.error("ERRO AO CONSULTAR RESERVA ANTES DO CANCELAMENTO:", bookingBeforeError);
      throw new Error('Não foi possível verificar a reserva antes de cancelar.');
    }

    if (!bookingBefore) {
      throw new Error('Reserva não encontrada no banco.');
    }

    if (bookingBefore.status === 'cancelada') {
      console.log("Reserva já está com status 'cancelada'.");
      return;
    }

    const isCreator = bookingBefore.criador_id === userId;
    const isAdmin = ['PROPRIETARIO', 'ADMINISTRADOR'].includes(role);

    if (!isCreator && !isAdmin) {
      throw new Error('Você não tem permissão para cancelar esta reserva.');
    }

    // 4. Executar UPDATE no Supabase
    const nowIso = new Date().toISOString();
    const { data: updatedBooking, error: updateError } = await db
      .from('reservas')
      .update({
        status: 'cancelada',
        cancelado_por: userId,
        cancelado_em: nowIso
      })
      .eq('id', id)
      .select('id, status, criador_id, cancelado_por, cancelado_em');

    console.log("CANCELAMENTO: resultado UPDATE", {
      data: updatedBooking,
      error: updateError
    });

    console.log("LINHAS ALTERADAS:", updatedBooking);

    if (updateError) {
      console.error("ERRO NO UPDATE DE CANCELAMENTO:", updateError);
      const msg = String(updateError.message || '');
      const code = String(updateError.code || '');

      if (code === '42501' || msg.includes('row-level security') || msg.includes('permission') || msg.includes('policy')) {
        throw new Error('Você não tem permissão para cancelar esta reserva (RLS).');
      }
      if (msg.includes('JWT') || msg.includes('session') || msg.includes('token') || msg.includes('Auth session missing')) {
        throw new Error('Sua sessão expirou. Entre novamente.');
      }
      if (msg.includes('Failed to fetch') || msg.includes('Network')) {
        throw new Error('Não foi possível conectar ao servidor. Verifique sua internet.');
      }
      throw new Error(msg || 'Erro ao cancelar reserva.');
    }

    if (!updatedBooking || updatedBooking.length === 0) {
      throw new Error(
        "Nenhuma reserva foi alterada. Verifique RLS, ID da reserva e permissões."
      );
    }

    if (updatedBooking[0].status !== 'cancelada') {
      throw new Error(`Status da reserva não mudou para 'cancelada' (status retornado: ${updatedBooking[0].status}).`);
    }
  },

  async getUserNotifications(userId: string, groupId?: string): Promise<Notificacao[]> {
    let query = requireDb().from('notificacoes').select('*').eq('usuario_id', userId).order('criado_em', { ascending: false });
    if (groupId) query = query.eq('grupo_id', groupId);
    const { data, error } = await query;
    if (error) fail('Erro ao carregar notificações', error);
    return (data || []).map((row: any) => ({ ...row, created_at: row.criado_em }));
  },

  async markNotificationRead(id: string): Promise<void> {
    const { error } = await requireDb().from('notificacoes').update({ lida: true }).eq('id', id);
    if (error) fail('Erro ao marcar notificação', error);
  },

  async createNotification(groupId: string, userId: string, titulo: string, mensagem: string, tipo: Notificacao['tipo']): Promise<Notificacao> {
    const { data, error } = await requireDb().from('notificacoes').insert({ grupo_id: groupId, usuario_id: userId, titulo, mensagem, tipo, lida: false }).select().single();
    if (error) fail('Erro ao criar notificação', error);
    return { ...data, created_at: data.criado_em };
  },

  async changeUserPassword(_userId: string, _current: string, password: string): Promise<void> {
    const { error } = await requireDb().auth.updateUser({ password });
    if (error) fail('Erro ao alterar senha', error);
  },

  async getUserBookingsAll(userId: string, groupId?: string): Promise<Reserva[]> {
    let query = requireDb().from('reservas').select('*, quadra:quadras(numero), horario:horarios(hora_inicio,hora_fim), criador:usuarios!reservas_criador_id_fkey(id, nome), adversario:usuarios!reservas_adversario_id_fkey(id, nome)').eq('criador_id', userId).order('data', { ascending: false });
    if (groupId) query = query.eq('grupo_id', groupId);
    const { data, error } = await query;
    if (error) {
      console.error('Erro ao carregar histórico:', error);
      fail('Erro ao carregar histórico', error);
    }
    return Promise.all((data || []).map(mapReservation));
  },

  async getAllGroupBookings(groupId: string): Promise<Reserva[]> {
    const { data, error } = await requireDb().from('reservas').select('*, quadra:quadras(numero), horario:horarios(hora_inicio,hora_fim), criador:usuarios!reservas_criador_id_fkey(id, nome), adversario:usuarios!reservas_adversario_id_fkey(id, nome)').eq('grupo_id', groupId).order('data', { ascending: false });
    if (error) {
      console.error('Erro ao carregar reservas:', error);
      fail('Erro ao carregar reservas', error);
    }
    return Promise.all((data || []).map(mapReservation));
  },

  async logout(): Promise<void> {
    const db = requireDb();
    const { error } = await db.auth.signOut();
    if (error) fail('Erro ao sair', error);
  }
};
