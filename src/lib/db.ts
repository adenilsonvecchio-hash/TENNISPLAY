import {
  AuthSession, CadastroJogadorData, CadastroProprietarioData, CourtConfig, DEFAULT_HORARIOS_PADRAO,
  Grupo, MemberStatus, MembroGrupo, Notificacao, PerfilRole, PlayerClass, DEFAULT_PLAYER_CLASSES, Quadra, Reserva, TimeSlot, Usuario,
  Partida, PartidaSet, PartidaStatus, EstatisticasJogador, RankingJogador, FeedItem, DesempenhoMes, EstatisticasPorClasse,
  ConfrontoDireto, ConfrontoPartidaResumo
} from '../types';
import { getSupabaseClient } from './supabase';
import { normalizeLocation } from './location';
import { getDayOfWeek, getTodayCivilDate, formatCivilDate, formatBrDate, isPastCivilDate, isPastTimeSlot } from './dateUtils';
import { PLAYER_AVATARS_BUCKET, validateAvatarFile, convertImageToWebp } from './avatarImage';
import { LocalCache } from './cache';
import { clearAllMemoryCache } from './swr';
import { perf } from './perf';

export { PLAYER_AVATARS_BUCKET };

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
  perf.start('profile_load');
  const db = requireDb();
  const [{ data: userRow, error: userError }, { data: memberRows, error: memberError }] = await Promise.all([
    db.from('usuarios').select('id, nome, email, whatsapp, avatar_url, criado_em').eq('id', userId).single(),
    db.from('membros_grupo').select('*, grupo:grupos(*)').eq('usuario_id', userId)
  ]);
  if (userError) fail('Erro ao carregar perfil', userError);
  if (memberError) fail('Erro ao carregar grupos', memberError);
  const members = (memberRows || []).map(mapMember);
  const active = members.find((m) => m.status === 'ATIVO') || members.find((m) => m.status === 'PENDENTE') || members[0];
  const session: AuthSession = { user: mapUser(userRow), membros: members, activeGroup: active?.grupo || null, activeRole: active?.perfil || null };
  LocalCache.setCachedSession(session);
  perf.end('profile_load');
  return session;
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

async function loadGroupClasses(groupId: string, userIds: string[]): Promise<Map<string, PlayerClass>> {
  const map = new Map<string, PlayerClass>();
  if (!groupId || !userIds || userIds.length === 0) return map;

  const cleanIds = Array.from(new Set(userIds.filter(Boolean)));
  if (cleanIds.length === 0) return map;

  try {
    const db = requireDb();
    const { data, error } = await db
      .from('membros_grupo')
      .select('usuario_id, classe')
      .eq('grupo_id', groupId)
      .in('usuario_id', cleanIds);

    if (!error && data) {
      data.forEach((row: any) => {
        map.set(row.usuario_id, classFromDb(row.classe));
      });
    }
  } catch (err) {
    console.warn('[loadGroupClasses] Erro ao carregar classes:', err);
  }

  return map;
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
    status: row.status || 'confirmada',
    created_at: row.criado_em
  };
}

async function mapMatch(row: any, currentUserId?: string, externalClassMap?: Map<string, PlayerClass>): Promise<Partida> {
  const sets: PartidaSet[] = (row.partida_sets || row.sets || []).map((s: any) => ({
    id: s.id,
    partida_id: s.partida_id,
    numero_set: s.numero_set,
    jogador_1_games: Number(s.jogador_1_games || 0),
    jogador_2_games: Number(s.jogador_2_games || 0),
    created_at: s.created_at || s.criado_em
  })).sort((a: PartidaSet, b: PartidaSet) => a.numero_set - b.numero_set);

  const likesList = row.partida_curtidas || [];
  const curtidasCount = row.curtidas_count !== undefined ? row.curtidas_count : likesList.length;
  const usuarioCurtiu = currentUserId ? likesList.some((c: any) => c.usuario_id === currentUserId) : false;

  let parsedReserva: Reserva | undefined = undefined;
  if (row.reserva) {
    parsedReserva = await mapReservation(row.reserva);
  }

  const j1Id = row.jogador_1_id;
  const j2Id = row.jogador_2_id;
  const j1Class = externalClassMap?.get(j1Id) || (row.jogador_1_membro?.classe ? classFromDb(row.jogador_1_membro.classe) : undefined);
  const j2Class = externalClassMap?.get(j2Id) || (row.jogador_2_membro?.classe ? classFromDb(row.jogador_2_membro.classe) : undefined);

  return {
    id: row.id,
    grupo_id: row.grupo_id,
    reserva_id: row.reserva_id,
    jogador_1_id: j1Id,
    jogador_2_id: j2Id,
    status: (row.status || 'CONFIRMADA') as PartidaStatus,
    resultado_informado_por: row.resultado_informado_por,
    vencedor_id: row.vencedor_id,
    foto_path: row.foto_path,
    foto_url: row.foto_url,
    detalhes_placar: row.detalhes_placar,
    criado_em: row.criado_em,
    finalizado_em: row.finalizado_em,
    jogador_1: row.jogador_1 ? mapUser(row.jogador_1) : undefined,
    jogador_2: row.jogador_2 ? mapUser(row.jogador_2) : undefined,
    jogador_1_classe: j1Class,
    jogador_2_classe: j2Class,
    vencedor: row.vencedor ? mapUser(row.vencedor) : undefined,
    grupo: row.grupo ? mapGroup(row.grupo) : undefined,
    reserva: parsedReserva,
    sets,
    curtidas_count: curtidasCount,
    usuario_curtiu: usuarioCurtiu
  };
}

async function enrichReservationsWithMatches(
  reservas: any[],
  currentUserId?: string,
  groupId?: string
): Promise<Reserva[]> {
  if (!reservas || reservas.length === 0) return [];
  const db = requireDb();

  const reservaIds = reservas.map((r) => r.id).filter(Boolean);
  const matchesByReservaId = new Map<string, any>();
  const userIdsSet = new Set<string>();

  reservas.forEach((r) => {
    if (r.criador_id) userIdsSet.add(r.criador_id);
  });

  if (reservaIds.length > 0) {
    try {
      const { data: matches, error } = await db
        .from('partidas')
        .select(`
          *,
          jogador_1:usuarios!partidas_jogador_1_id_fkey(id, nome, email, whatsapp, avatar_url, criado_em),
          jogador_2:usuarios!partidas_jogador_2_id_fkey(id, nome, email, whatsapp, avatar_url, criado_em),
          vencedor:usuarios!partidas_vencedor_id_fkey(id, nome),
          partida_sets(*)
        `)
        .in('reserva_id', reservaIds)
        .neq('status', 'CANCELADA');

      if (!error && matches) {
        matches.forEach((m: any) => {
          matchesByReservaId.set(m.reserva_id, m);
          if (m.jogador_1_id) userIdsSet.add(m.jogador_1_id);
          if (m.jogador_2_id) userIdsSet.add(m.jogador_2_id);
        });
      }
    } catch (mErr) {
      console.warn('[enrichReservationsWithMatches] Erro ao buscar partidas associadas:', mErr);
    }
  }

  // Buscar classes dos membros no grupo especificado
  const effectiveGroupId = groupId || reservas[0]?.grupo_id;
  const classMap = effectiveGroupId
    ? await loadGroupClasses(effectiveGroupId, Array.from(userIdsSet))
    : new Map<string, PlayerClass>();

  return Promise.all(
    reservas.map(async (row) => {
      const baseReserva = await mapReservation(row);
      const matchRow = matchesByReservaId.get(row.id);

      if (matchRow) {
        const j1Id = matchRow.jogador_1_id;
        const j2Id = matchRow.jogador_2_id;
        const j1Name = matchRow.jogador_1?.nome || 'Jogador 1';
        const j2Name = matchRow.jogador_2?.nome || 'Jogador 2';
        const j1Class = classMap.get(j1Id) || classFromDb(matchRow.jogador_1_membro?.classe);
        const j2Class = classMap.get(j2Id) || classFromDb(matchRow.jogador_2_membro?.classe);

        const matchObj: Partida = {
          id: matchRow.id,
          grupo_id: matchRow.grupo_id,
          reserva_id: matchRow.reserva_id,
          jogador_1_id: j1Id,
          jogador_2_id: j2Id,
          status: (matchRow.status || 'CONFIRMADA') as PartidaStatus,
          resultado_informado_por: matchRow.resultado_informado_por,
          vencedor_id: matchRow.vencedor_id,
          foto_path: matchRow.foto_path,
          foto_url: matchRow.foto_url,
          detalhes_placar: matchRow.detalhes_placar,
          criado_em: matchRow.criado_em,
          finalizado_em: matchRow.finalizado_em,
          jogador_1: matchRow.jogador_1 ? mapUser(matchRow.jogador_1) : undefined,
          jogador_2: matchRow.jogador_2 ? mapUser(matchRow.jogador_2) : undefined,
          jogador_1_classe: j1Class,
          jogador_2_classe: j2Class,
          vencedor: matchRow.vencedor ? mapUser(matchRow.vencedor) : undefined,
          reserva: baseReserva,
          sets: (matchRow.partida_sets || []).map((s: any) => ({
            id: s.id,
            partida_id: s.partida_id,
            numero_set: s.numero_set,
            jogador_1_games: Number(s.jogador_1_games || 0),
            jogador_2_games: Number(s.jogador_2_games || 0),
            created_at: s.created_at || s.criado_em
          })).sort((a: PartidaSet, b: PartidaSet) => a.numero_set - b.numero_set)
        };

        // Identificação do adversário comparando com o usuário autenticado
        let advId: string | undefined = undefined;
        let advNome: string | undefined = undefined;
        let advClasse: PlayerClass | undefined = undefined;

        if (currentUserId) {
          if (j1Id === currentUserId) {
            advId = j2Id;
            advNome = j2Name;
            advClasse = j2Class;
          } else if (j2Id === currentUserId) {
            advId = j1Id;
            advNome = j1Name;
            advClasse = j1Class;
          }
        }

        // Se não identificado por currentUserId mas o criador for conhecido
        if (!advNome && baseReserva.jogador_id) {
          if (baseReserva.jogador_id === j1Id) {
            advId = j2Id;
            advNome = j2Name;
            advClasse = j2Class;
          } else if (baseReserva.jogador_id === j2Id) {
            advId = j1Id;
            advNome = j1Name;
            advClasse = j1Class;
          }
        }

        return {
          ...baseReserva,
          partida_id: matchRow.id,
          partida: matchObj,
          jogador_1_id: j1Id,
          jogador_1_nome: j1Name,
          jogador_1_classe: j1Class,
          jogador_2_id: j2Id,
          jogador_2_nome: j2Name,
          jogador_2_classe: j2Class,
          adversario_id: advId,
          adversario_nome: advNome,
          adversario_classe: advClasse,
          jogador_classe: classMap.get(baseReserva.jogador_id) || baseReserva.jogador_classe
        };
      }

      // Se não há partida vinculada
      return {
        ...baseReserva,
        jogador_classe: classMap.get(baseReserva.jogador_id) || baseReserva.jogador_classe
      };
    })
  );
}

export const DbService = {
  loadSession(userId: string): Promise<AuthSession> { return loadSession(userId); },
  saveCurrentSession(session: AuthSession | null): void {
    LocalCache.setCachedSession(session);
  },
  getCurrentSession(): AuthSession | null {
    return LocalCache.getCachedSession();
  },

  async logout(userId?: string): Promise<void> {
    LocalCache.clearUserPrivateData(userId);
    clearAllMemoryCache(userId);
    const db = getSupabaseClient();
    if (db) {
      try {
        await db.removeAllChannels();
        await db.auth.signOut();
      } catch (err) {
        console.warn('[DbService.logout] Erro ao deslogar do Supabase:', err);
      }
    }
  },

  async restoreSession(): Promise<AuthSession | null> {
    perf.start('session_restore');
    const db = getSupabaseClient();
    if (!db) {
      perf.end('session_restore');
      return null;
    }

    try {
      const { data, error } = await db.auth.getSession();
      if (error) {
        console.error('[Supabase getSession Error]:', error.code, error.message, error);
        LocalCache.setCachedSession(null);
        perf.end('session_restore');
        return null;
      }

      if (!data.session?.user) {
        LocalCache.setCachedSession(null);
        perf.end('session_restore');
        return null;
      }

      // Aguarda e executa eventual cadastro pendente em user_metadata assim que houver sessão válida
      await completePendingOnboarding(data.session.user);

      const session = await loadSession(data.session.user.id);
      LocalCache.setCachedSession(session);
      perf.end('session_restore');
      return session;
    } catch (err) {
      console.warn('[DbService.restoreSession] Falha ao restaurar sessão silenciosamente:', err);
      perf.end('session_restore');
      return null;
    }
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


  async approveMemberWithClass(memberId: string, value: PlayerClass): Promise<{ members: MembroGrupo[]; message: string; approvedClass: PlayerClass }> {
    const db = requireDb();
    
    // Validar se classe informada não é vazia ou Sem Classe
    if (!value || value === 'Sem Classe') {
      fail('É obrigatório selecionar uma classe válida para aprovar o jogador.');
    }

    const { data: current, error: findError } = await db
      .from('membros_grupo')
      .select('grupo_id, usuario:usuarios(nome)')
      .eq('id', memberId)
      .single();

    if (findError || !current) fail('Membro não encontrado', findError);

    // Tentar executar via RPC segura public.aprovar_jogador
    const { data: rpcRes, error: rpcErr } = await db.rpc('aprovar_jogador', {
      p_membro_id: memberId,
      p_classe: value
    });

    if (rpcErr) {
      console.warn('[RPC aprovar_jogador fallback triggered]:', rpcErr.message);
      // Fallback seguro caso a instância ainda não tenha compilado a migração
      const dbClass = classToDb(value);
      if (!dbClass) fail('Classe selecionada inválida');

      const { error: updateErr } = await db
        .from('membros_grupo')
        .update({ status: 'ativo', classe: dbClass })
        .eq('id', memberId);

      if (updateErr) fail(updateErr.message || 'Erro ao aprovar jogador', updateErr);
    }

    const updatedMembers = await this.getGroupMembers(current.grupo_id);
    const jogadorNome = (current.usuario as any)?.nome || 'Jogador';
    const message = rpcRes?.mensagem || `${jogadorNome} foi aprovado na ${value}.`;

    return {
      members: updatedMembers,
      message,
      approvedClass: value
    };
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
    if (error) {
      console.error('[Supabase updateUserProfile Error]:', error);
      fail('Falha ao atualizar dados do usuário no banco de dados', error);
    }
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

  async getBookingsForDate(groupId: string, date: string, currentUserId?: string): Promise<Reserva[]> {
    const { data, error } = await requireDb()
      .from('reservas')
      .select('*, quadra:quadras(id, numero, nome), horario:horarios(id, hora_inicio, hora_fim), criador:usuarios!reservas_criador_id_fkey(id, nome)')
      .eq('grupo_id', groupId)
      .eq('data', date)
      .in('status', ['aguardando', 'confirmada']);
    if (error) {
      console.error('Erro ao sincronizar reservas:', error);
      fail('Erro ao sincronizar reservas', error);
    }
    return enrichReservationsWithMatches(data || [], currentUserId, groupId);
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
      .select('*, quadra:quadras(id, numero, nome), horario:horarios(id, hora_inicio, hora_fim), criador:usuarios!reservas_criador_id_fkey(id, nome)')
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

  async cancelBooking(id: string, userId: string, role: PerfilRole, isOpponentRejection: boolean = false): Promise<void> {
    const db = requireDb();

    // 1. Log temporário de diagnóstico
    console.log('CANCELAMENTO DEBUG', {
      id,
      userId,
      role,
      isOpponentRejection
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

    if (!isCreator && !isAdmin && !isOpponentRejection) {
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
    const db = requireDb();
    let query = db
      .from('reservas')
      .select('*, quadra:quadras(id, numero, nome), horario:horarios(id, hora_inicio, hora_fim), criador:usuarios!reservas_criador_id_fkey(id, nome)')
      .order('data', { ascending: false });

    if (groupId) query = query.eq('grupo_id', groupId);

    // Buscar partidas onde o usuário é jogador_2 para também incluir no histórico
    const { data: userMatches } = await db
      .from('partidas')
      .select('reserva_id')
      .eq('jogador_2_id', userId)
      .not('reserva_id', 'is', null);

    const matchReservaIds = (userMatches || []).map((m: any) => m.reserva_id).filter(Boolean);

    if (matchReservaIds.length > 0) {
      query = query.or(`criador_id.eq.${userId},id.in.(${matchReservaIds.join(',')})`);
    } else {
      query = query.eq('criador_id', userId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Erro ao carregar histórico:', error);
      fail('Erro ao carregar histórico', error);
    }
    return enrichReservationsWithMatches(data || [], userId, groupId);
  },

  async getAllGroupBookings(groupId: string, currentUserId?: string): Promise<Reserva[]> {
    const { data, error } = await requireDb()
      .from('reservas')
      .select('*, quadra:quadras(id, numero, nome), horario:horarios(id, hora_inicio, hora_fim), criador:usuarios!reservas_criador_id_fkey(id, nome)')
      .eq('grupo_id', groupId)
      .order('data', { ascending: false });
    if (error) {
      console.error('Erro ao carregar reservas:', error);
      fail('Erro ao carregar reservas', error);
    }
    return enrichReservationsWithMatches(data || [], currentUserId, groupId);
  },

  // ==========================================
  // MÓDULO DE PARTIDAS, RESULTADOS E PLACAR
  // ==========================================

  async createMatch(input: {
    grupoId: string;
    reservaId?: string;
    jogador1Id: string;
    jogador2Id: string;
    status?: PartidaStatus;
  }): Promise<Partida> {
    const db = requireDb();
    const primaryStatus = input.status || 'PENDENTE';

    console.log('[DEBUG createMatch] Input:', {
      grupo_id: input.grupoId,
      reserva_id: input.reservaId,
      jogador_1_id: input.jogador1Id,
      jogador_2_id: input.jogador2Id,
      status: primaryStatus
    });

    let insertResult = await db
      .from('partidas')
      .insert({
        grupo_id: input.grupoId,
        reserva_id: input.reservaId || null,
        jogador_1_id: input.jogador1Id,
        jogador_2_id: input.jogador2Id,
        status: primaryStatus
      })
      .select(`
        *,
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*), criador:usuarios!reservas_criador_id_fkey(*)),
        partida_sets(*)
      `)
      .single();

    // Fallback inteligente para compatibilidade com constraints legadas
    if (insertResult.error && (insertResult.error.message?.includes('partidas_status_check') || insertResult.error.code === '23514')) {
      console.warn('[createMatch] Tentando fallback para status legado AGUARDANDO_ACEITE devido a constraint:', insertResult.error);
      const fallbackStatus = primaryStatus === 'PENDENTE' ? 'AGUARDANDO_ACEITE' : 'PENDENTE';
      insertResult = await db
        .from('partidas')
        .insert({
          grupo_id: input.grupoId,
          reserva_id: input.reservaId || null,
          jogador_1_id: input.jogador1Id,
          jogador_2_id: input.jogador2Id,
          status: fallbackStatus
        })
        .select(`
          *,
          jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
          jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
          reserva:reservas(*, quadra:quadras(*), horario:horarios(*), criador:usuarios!reservas_criador_id_fkey(*)),
          partida_sets(*)
        `)
        .single();
    }

    if (insertResult.error) {
      console.error('[Supabase Create Match Error]:', insertResult.error);
      throw new Error('Não foi possível enviar o desafio. Tente novamente.');
    }

    const data = insertResult.data;
    console.log('[DEBUG createMatch] Partida criada com sucesso:', data);

    // Criar notificação para o adversário convidado
    try {
      const { data: creatorUser } = await db.from('usuarios').select('nome').eq('id', input.jogador1Id).single();
      const creatorName = creatorUser?.nome || 'Um jogador';
      if (primaryStatus === 'PENDENTE' || primaryStatus === 'AGUARDANDO_ACEITE') {
        await this.createNotification(
          input.grupoId,
          input.jogador2Id,
          'Você foi desafiado! 🎾',
          `${creatorName} desafiou você para uma partida. Aceite ou recuse o desafio.`,
          'DESAFIO_RECEBIDO'
        );
      } else {
        await this.createNotification(
          input.grupoId,
          input.jogador2Id,
          'Novo Jogo Marcado! 🎾',
          `${creatorName} marcou uma partida com você. Confira na sua agenda.`,
          'PARTIDA_CRIADA'
        );
      }
    } catch (notifErr) {
      console.warn('Erro ao disparar notificação de partida:', notifErr);
    }

    const classMap = await loadGroupClasses(input.grupoId, [input.jogador1Id, input.jogador2Id]);
    return mapMatch(data, input.jogador1Id, classMap);
  },

  async getMatchesForGroup(groupId: string, currentUserId?: string): Promise<Partida[]> {
    const db = requireDb();
    const { data, error } = await db
      .from('partidas')
      .select(`
        *,
        grupo:grupos(*),
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        vencedor:usuarios!partidas_vencedor_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*), criador:usuarios!reservas_criador_id_fkey(*)),
        partida_sets(*),
        partida_curtidas(id, usuario_id)
      `)
      .eq('grupo_id', groupId)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('[Supabase getMatchesForGroup Error]:', error);
      fail('Erro ao carregar partidas do grupo', error);
    }

    const userIds: string[] = [];
    (data || []).forEach((row: any) => {
      if (row.jogador_1_id) userIds.push(row.jogador_1_id);
      if (row.jogador_2_id) userIds.push(row.jogador_2_id);
    });
    const classMap = await loadGroupClasses(groupId, userIds);

    return Promise.all((data || []).map((row) => mapMatch(row, currentUserId, classMap)));
  },

  async getMatchesForUser(userId: string, groupId?: string): Promise<Partida[]> {
    const db = requireDb();
    let query = db
      .from('partidas')
      .select(`
        *,
        grupo:grupos(*),
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        vencedor:usuarios!partidas_vencedor_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*), criador:usuarios!reservas_criador_id_fkey(*)),
        partida_sets(*),
        partida_curtidas(id, usuario_id)
      `)
      .or(`jogador_1_id.eq.${userId},jogador_2_id.eq.${userId}`)
      .order('criado_em', { ascending: false });

    if (groupId) {
      query = query.eq('grupo_id', groupId);
    }

    const { data, error } = await query;
    if (error) {
      console.error('[Supabase getMatchesForUser Error]:', error);
      fail('Erro ao carregar partidas do usuário', error);
    }

    const userIds: string[] = [];
    const effectiveGroupId = groupId || (data && data[0]?.grupo_id);
    (data || []).forEach((row: any) => {
      if (row.jogador_1_id) userIds.push(row.jogador_1_id);
      if (row.jogador_2_id) userIds.push(row.jogador_2_id);
    });
    const classMap = effectiveGroupId ? await loadGroupClasses(effectiveGroupId, userIds) : new Map<string, PlayerClass>();

    return Promise.all((data || []).map((row) => mapMatch(row, userId, classMap)));
  },

  async getMatchById(matchId: string, currentUserId?: string): Promise<Partida | null> {
    const db = requireDb();
    const { data, error } = await db
      .from('partidas')
      .select(`
        *,
        grupo:grupos(*),
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        vencedor:usuarios!partidas_vencedor_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*), criador:usuarios!reservas_criador_id_fkey(*)),
        partida_sets(*),
        partida_curtidas(id, usuario_id)
      `)
      .eq('id', matchId)
      .maybeSingle();

    if (error) {
      console.error('[Supabase getMatchById Error]:', error);
      fail('Erro ao carregar detalhes da partida', error);
    }

    if (!data) return null;
    const classMap = await loadGroupClasses(data.grupo_id, [data.jogador_1_id, data.jogador_2_id]);
    return mapMatch(data, currentUserId, classMap);
  },

  async submitMatchScore(input: {
    matchId: string;
    userId: string;
    sets: { numero_set: number; jogador_1_games: number; jogador_2_games: number }[];
    fotoUrl?: string;
    fotoPath?: string;
    isAdminOrOwner?: boolean;
  }): Promise<{ status: PartidaStatus; vencedorId: string; placar: string }> {
    const db = requireDb();

    // 1. Chamar RPC transacional primária `enviar_resultado_partida`
    let rpcRes = await db.rpc('enviar_resultado_partida', {
      p_partida_id: input.matchId,
      p_sets: input.sets,
      p_foto_url: input.fotoUrl || null,
      p_foto_path: input.fotoPath || null
    });

    // 2. Fallback de assinatura se a função principal não estiver definida
    if (rpcRes.error && rpcRes.error.message?.includes('function') && rpcRes.error.message?.includes('does not exist')) {
      rpcRes = await db.rpc('salvar_resultado_partida', {
        p_partida_id: input.matchId,
        p_sets: input.sets,
        p_foto_url: input.fotoUrl || null,
        p_foto_path: input.fotoPath || null
      });
    }

    if (rpcRes.error) {
      console.error('[submitMatchScore RPC Error]:', rpcRes.error);
      fail(rpcRes.error.message || 'Erro ao enviar resultado da partida', rpcRes.error);
    }

    const rpcData = rpcRes.data;
    return {
      status: (rpcData?.status || (input.isAdminOrOwner ? 'FINALIZADA' : 'AGUARDANDO_CONFIRMACAO_RESULTADO')) as PartidaStatus,
      vencedorId: rpcData?.vencedor_id,
      placar: rpcData?.placar
    };
  },

  async confirmMatchResult(matchId: string, userId: string, isAdminOrOwner = false): Promise<void> {
    const db = requireDb();

    try {
      const { data: rpcData, error: rpcError } = await db.rpc('confirmar_resultado_partida', {
        p_partida_id: matchId
      });

      if (!rpcError && rpcData) return;
      if (rpcError) console.warn('RPC confirmar_resultado_partida falhou, usando fallback direto:', rpcError.message);
    } catch (err) {
      console.warn('Erro ao chamar RPC confirmar_resultado_partida:', err);
    }

    // Fallback Direto
    const { data: match, error: fetchErr } = await db
      .from('partidas')
      .select('id, grupo_id, jogador_1_id, jogador_2_id, resultado_informado_por, detalhes_placar')
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) fail('Partida não encontrada para confirmação', fetchErr);

    if (!isAdminOrOwner && match.resultado_informado_por === userId) {
      throw new Error('A confirmação deve ser realizada pelo adversário.');
    }

    const { error: updateErr } = await db
      .from('partidas')
      .update({
        status: 'FINALIZADA',
        finalizado_em: new Date().toISOString()
      })
      .eq('id', matchId);

    if (updateErr) fail('Erro ao confirmar resultado da partida', updateErr);

    if (match.resultado_informado_por && match.resultado_informado_por !== userId) {
      const { data: confirmer } = await db.from('usuarios').select('nome').eq('id', userId).single();
      const confirmerName = confirmer?.nome || 'Seu adversário';

      await this.createNotification(
        match.grupo_id,
        match.resultado_informado_por,
        'Resultado Confirmado! 🏆',
        `${confirmerName} confirmou o placar da partida. Suas estatísticas foram atualizadas.`,
        'RESULTADO_CONFIRMADO'
      );
    }
  },

  async requestScoreCorrection(matchId: string, userId: string, motivo?: string): Promise<void> {
    const db = requireDb();

    try {
      const { data: rpcData, error: rpcError } = await db.rpc('solicitar_correcao_partida', {
        p_partida_id: matchId,
        p_motivo: motivo || null
      });

      if (!rpcError && rpcData) return;
      if (rpcError) console.warn('RPC solicitar_correcao_partida falhou, usando fallback direto:', rpcError.message);
    } catch (err) {
      console.warn('Erro ao chamar RPC solicitar_correcao_partida:', err);
    }

    // Fallback Direto
    const { data: match, error: fetchErr } = await db
      .from('partidas')
      .select('id, grupo_id, jogador_1_id, jogador_2_id, resultado_informado_por')
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) fail('Partida não encontrada para solicitação de correção', fetchErr);

    const { error: updateErr } = await db
      .from('partidas')
      .update({
        status: 'AGUARDANDO_RESULTADO',
        resultado_informado_por: null
      })
      .eq('id', matchId);

    if (updateErr) fail('Erro ao solicitar correção', updateErr);

    if (match.resultado_informado_por && match.resultado_informado_por !== userId) {
      const { data: requester } = await db.from('usuarios').select('nome').eq('id', userId).single();
      const reqName = requester?.nome || 'Seu adversário';

      await this.createNotification(
        match.grupo_id,
        match.resultado_informado_por,
        'Correção de Placar Solicitada ⚠️',
        `${reqName} contestou o resultado informado. Por favor, reenvie o placar correto.`,
        'CORRECAO_SOLICITADA'
      );
    }
  },

  async cancelMatch(matchId: string, userId: string): Promise<void> {
    const db = requireDb();
    const { data: match } = await db.from('partidas').select('id, status, reserva_id').eq('id', matchId).single();
    if (!match) return;

    await db.from('partidas').update({ status: 'CANCELADA' }).eq('id', matchId);

    // Se houver reserva associada e ainda estiver ativa, cancelar também
    if (match.reserva_id) {
      try {
        await this.cancelBooking(match.reserva_id, userId, 'JOGADOR');
      } catch (err) {
        console.warn('Reserva já cancelada ou não foi possível cancelar em cascata:', err);
      }
    }
  },

  async getPendingChallenges(userId: string, groupId?: string): Promise<Partida[]> {
    const db = requireDb();

    console.log('[DEBUG getPendingChallenges] Usuário autenticado:', userId);
    console.log('[DEBUG getPendingChallenges] Grupo atual:', groupId);

    let query = db
      .from('partidas')
      .select(`
        *,
        jogador_1:usuarios!partidas_jogador_1_id_fkey(
          id,
          nome,
          email,
          whatsapp,
          avatar_url,
          criado_em
        ),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(
          id,
          nome,
          email,
          whatsapp,
          avatar_url,
          criado_em
        ),
        reserva:reservas(
          *,
          quadra:quadras(id, numero, nome),
          horario:horarios(id, hora_inicio, hora_fim)
        ),
        partida_sets(*)
      `)
      .eq('jogador_2_id', userId)
      .in('status', ['PENDENTE', 'AGUARDANDO_ACEITE'])
      .order('criado_em', { ascending: false });

    if (groupId) {
      query = query.eq('grupo_id', groupId);
    }

    const { data, error } = await query;

    console.log('[DEBUG getPendingChallenges] Desafios recebidos:', data);
    if (error) {
      console.error('[DEBUG getPendingChallenges] Erro ao buscar desafios:', error);
      return [];
    }

    const userIds: string[] = [];
    const effectiveGroupId = groupId || (data && data[0]?.grupo_id);
    (data || []).forEach((row: any) => {
      if (row.jogador_1_id) userIds.push(row.jogador_1_id);
      if (row.jogador_2_id) userIds.push(row.jogador_2_id);
    });
    const classMap = effectiveGroupId ? await loadGroupClasses(effectiveGroupId, userIds) : new Map<string, PlayerClass>();

    return Promise.all((data || []).map((row) => mapMatch(row, userId, classMap)));
  },

  async acceptChallenge(matchId: string, userId: string): Promise<void> {
    const db = requireDb();
    const { data: match, error: fetchErr } = await db
      .from('partidas')
      .select(`
        *,
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*))
      `)
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) {
      fail('Partida não encontrada para aceite', fetchErr);
    }

    if (match.jogador_2_id !== userId) {
      throw new Error('Apenas o jogador desafiado pode aceitar este desafio.');
    }

    if (!['PENDENTE', 'AGUARDANDO_ACEITE'].includes(match.status)) {
      throw new Error('Este desafio já foi respondido ou não está mais pendente.');
    }

    let { error: updateErr } = await db
      .from('partidas')
      .update({
        status: 'ACEITA'
      })
      .eq('id', matchId);

    // Fallback para status legado CONFIRMADA caso a constraint antiga ainda esteja ativa
    if (updateErr && (updateErr.message?.includes('partidas_status_check') || updateErr.code === '23514')) {
      console.warn('[acceptChallenge] Tentando fallback para status legado CONFIRMADA:', updateErr);
      const { error: fallbackErr } = await db
        .from('partidas')
        .update({
          status: 'CONFIRMADA'
        })
        .eq('id', matchId);
      updateErr = fallbackErr;
    }

    if (updateErr) {
      console.error('[Supabase acceptChallenge Error]:', updateErr);
      fail('Erro ao aceitar desafio', updateErr);
    }

    // Se a reserva tiver nome_convidado genérico, atualizar com o nome real
    if (match.reserva_id) {
      try {
        const { data: accepter } = await db.from('usuarios').select('nome').eq('id', userId).single();
        await db
          .from('reservas')
          .update({
            nome_convidado: accepter?.nome || 'Adversário confirmado'
          })
          .eq('id', match.reserva_id);
      } catch (rErr) {
        console.warn('Erro ao atualizar nome do adversário na reserva:', rErr);
      }
    }

    // Notificar o desafiante (jogador 1)
    try {
      const { data: accepter } = await db.from('usuarios').select('nome').eq('id', userId).single();
      const accepterName = accepter?.nome || 'Seu adversário';
      const dataStr = match.reserva?.data ? ` para o dia ${match.reserva.data}` : '';
      const horaStr = match.reserva?.horario?.hora_inicio ? ` às ${match.reserva.horario.hora_inicio.substring(0, 5)}` : '';

      await this.createNotification(
        match.grupo_id,
        match.jogador_1_id,
        'Desafio Aceito! 🎾',
        `${accepterName} aceitou seu desafio${dataStr}${horaStr}. O jogo está confirmado na agenda!`,
        'DESAFIO_ACEITO'
      );
    } catch (notifErr) {
      console.warn('Erro ao disparar notificação de desafio aceito:', notifErr);
    }
  },

  async rejectChallenge(matchId: string, userId: string, motivo?: string): Promise<void> {
    const db = requireDb();
    const { data: match, error: fetchErr } = await db
      .from('partidas')
      .select(`
        *,
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*))
      `)
      .eq('id', matchId)
      .single();

    if (fetchErr || !match) {
      fail('Partida não encontrada para recusa', fetchErr);
    }

    if (match.jogador_2_id !== userId) {
      throw new Error('Apenas o jogador desafiado pode recusar este desafio.');
    }

    if (!['PENDENTE', 'AGUARDANDO_ACEITE'].includes(match.status)) {
      throw new Error('Este desafio já foi respondido ou não está mais pendente.');
    }

    // 1. Atualizar status da partida para RECUSADA (com fallback para CANCELADA se necessário)
    let { error: updateErr } = await db
      .from('partidas')
      .update({
        status: 'RECUSADA'
      })
      .eq('id', matchId);

    if (updateErr) {
      console.warn('Fallback para CANCELADA ao recusar partida:', updateErr);
      const { error: fallbackErr } = await db
        .from('partidas')
        .update({ status: 'CANCELADA' })
        .eq('id', matchId);
      if (fallbackErr) {
        console.error('[Supabase rejectChallenge Error]:', fallbackErr);
        fail('Erro ao recusar desafio', fallbackErr);
      }
    }

    // 2. Liberar a quadra e o horário cancelando a reserva
    if (match.reserva_id) {
      try {
        await this.cancelBooking(match.reserva_id, userId, 'JOGADOR', true);
      } catch (cancelErr) {
        console.warn('Erro ao cancelar reserva vinculada ao desafio recusado:', cancelErr);
      }
    }

    // 3. Notificar o desafiante (jogador 1)
    try {
      const { data: rejecter } = await db.from('usuarios').select('nome').eq('id', userId).single();
      const rejecterName = rejecter?.nome || 'Seu adversário';
      const motivoText = motivo ? ` Motivo: ${motivo}` : '';
      const dataStr = match.reserva?.data ? ` para o dia ${match.reserva.data}` : '';

      await this.createNotification(
        match.grupo_id,
        match.jogador_1_id,
        'Desafio Recusado',
        `${rejecterName} não pôde aceitar seu desafio${dataStr}.${motivoText} A quadra e o horário foram liberados.`,
        'DESAFIO_RECUSADO'
      );
    } catch (notifErr) {
      console.warn('Erro ao disparar notificação de desafio recusado:', notifErr);
    }
  },

  // ==========================================
  // STORAGE & FOTOS (SUPABASE STORAGE)
  // ==========================================

  async uploadMatchPhoto(file: File, groupId: string, matchId: string): Promise<{ publicUrl: string; path: string }> {
    const db = requireDb();
    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `${groupId}/${matchId}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await db.storage
      .from('match-photos')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      console.error('[Supabase Storage match-photos Upload Error]:', uploadError);
      fail('Erro ao fazer upload da foto da partida', uploadError);
    }

    const { data: urlData } = db.storage.from('match-photos').getPublicUrl(filePath);
    return {
      publicUrl: urlData.publicUrl,
      path: filePath
    };
  },

  async uploadUserAvatar(file: File, userId: string): Promise<{ publicUrl: string; path: string }> {
    if (!userId) {
      throw new Error('Usuário não autenticado. Faça login novamente para atualizar a foto.');
    }

    // 1. Validação de formato e tamanho do arquivo (máx 5MB, JPG/PNG/WebP)
    const validation = validateAvatarFile(file);
    if (!validation.valid) {
      throw new Error(validation.error || 'Arquivo de imagem inválido.');
    }

    const db = requireDb();

    // 2. Converte a imagem para WebP otimizada
    let convertedBlob: Blob;
    try {
      convertedBlob = await convertImageToWebp(file, { maxDimension: 800, quality: 0.90 });
    } catch (convErr: any) {
      console.warn('[uploadUserAvatar] Falha na conversão WebP, usando arquivo original:', convErr);
      convertedBlob = file;
    }

    // 3. Caminho padronizado: ${user.id}/avatar.webp
    const avatarPath = `${userId}/avatar.webp`;

    // 4. Upload no bucket 'avatars' com upsert e contentType 'image/webp'
    const { error: uploadError } = await db.storage
      .from(PLAYER_AVATARS_BUCKET)
      .upload(avatarPath, convertedBlob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/webp'
      });

    if (uploadError) {
      console.error('[Supabase Storage avatars Upload Error]:', uploadError);
      const errMsg = uploadError.message || String(uploadError);
      const status = (uploadError as any).statusCode || (uploadError as any).status;

      if (errMsg.includes('Bucket not found') || errMsg.includes('bucket not found') || status === 404 || status === '404') {
        throw new Error("Bucket 'avatars' de armazenamento não encontrado no Supabase. Execute a migração 010_criar_bucket_avatars_e_politicas.sql ou crie o bucket 'avatars' público no painel do Supabase.");
      }

      if (errMsg.includes('JWT') || errMsg.includes('auth') || errMsg.includes('session') || errMsg.includes('not authenticated') || status === 401) {
        throw new Error('Sessão expirada ou usuário não autenticado. Faça login novamente para atualizar a foto.');
      }

      if (errMsg.includes('row-level security') || errMsg.includes('RLS') || errMsg.includes('violates row-level security policy') || errMsg.includes('Access Denied') || status === 403) {
        throw new Error('Permissão negada pelas políticas de segurança do Storage (RLS). Apenas o próprio usuário pode salvar na sua pasta.');
      }

      if (errMsg.includes('Payload too large') || errMsg.includes('Entity Too Large') || errMsg.includes('exceeded') || status === 413) {
        throw new Error('A imagem excede o tamanho máximo permitido de 5 MB.');
      }

      throw new Error(`Erro ao fazer upload da foto de perfil: ${errMsg}`);
    }

    // 5. Obter URL pública
    const { data: urlData } = db.storage
      .from(PLAYER_AVATARS_BUCKET)
      .getPublicUrl(avatarPath);

    return {
      publicUrl: urlData.publicUrl,
      path: avatarPath
    };
  },

  // ==========================================
  // ESTATÍSTICAS ESPORTIVAS, CONFRONTO DIRETO E RANKING
  // ==========================================

  async getPlayerStatistics(userId: string, groupId: string): Promise<EstatisticasJogador> {
    const db = requireDb();

    // Carregar todas as partidas do usuário no grupo (para ter contagens totais e estatísticas de jogos concluídos)
    const { data: rawMatches, error } = await db
      .from('partidas')
      .select(`
        *,
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        vencedor:usuarios!partidas_vencedor_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*)),
        partida_sets(*)
      `)
      .eq('grupo_id', groupId)
      .or(`jogador_1_id.eq.${userId},jogador_2_id.eq.${userId}`)
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('[Supabase getPlayerStatistics Error]:', error);
      fail('Erro ao calcular estatísticas do jogador', error);
    }

    // Carregar classes dos membros do grupo para estatística por classe
    const { data: members } = await db
      .from('membros_grupo')
      .select('usuario_id, classe')
      .eq('grupo_id', groupId);

    const memberClassMap = new Map<string, PlayerClass>();
    (members || []).forEach((m: any) => {
      memberClassMap.set(m.usuario_id, classFromDb(m.classe));
    });

    // Deduplicação por ID de partida
    const matchMap = new Map<string, any>();
    (rawMatches || []).forEach((m: any) => {
      if (m && m.id && !matchMap.has(m.id)) {
        matchMap.set(m.id, m);
      }
    });
    const allUserMatches = Array.from(matchMap.values());

    const totalCadastradas = allUserMatches.length;
    let partidasAgendadas = 0;
    let partidasAguardandoResultado = 0;
    let partidasConcluidas = 0;

    let vitorias = 0;
    let derrotas = 0;
    let setsVencidos = 0;
    let setsPerdidos = 0;
    let gamesVencidos = 0;
    let gamesPerdidos = 0;

    // Map por classe do adversário
    const classStatsMap: Record<string, { vitorias: number; derrotas: number }> = {};
    DEFAULT_PLAYER_CLASSES.forEach((cls) => {
      classStatsMap[cls] = { vitorias: 0, derrotas: 0 };
    });

    // Desempenho por mês no ano atual
    const currentYear = new Date().getFullYear();
    const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const mesesStats: DesempenhoMes[] = mesesNomes.map((mes, idx) => ({
      mes,
      mesNumero: idx + 1,
      vitorias: 0,
      derrotas: 0,
      total: 0
    }));

    // Lista de partidas concluídas com resultado confirmado para cálculo de sequências
    const concludedMatchesWithWinner: { match: any; isWinner: boolean; date: string }[] = [];

    allUserMatches.forEach((m: any) => {
      const statusUpper = String(m.status || '').toUpperCase().trim();
      const isJ1 = m.jogador_1_id === userId;
      const opponentId = isJ1 ? m.jogador_2_id : m.jogador_1_id;
      const opponentClass = memberClassMap.get(opponentId) || 'Sem Classe';

      // 1. Categorizar status da partida
      if (['PENDENTE', 'AGUARDANDO_ACEITE', 'ACEITA', 'CONFIRMADA'].includes(statusUpper)) {
        partidasAgendadas++;
      } else if (['AGUARDANDO_RESULTADO', 'AGUARDANDO_CONFIRMACAO_RESULTADO'].includes(statusUpper)) {
        partidasAguardandoResultado++;
      }

      // 2. Avaliar se a partida é concluída com resultado esportivo confirmado
      const isStatusConcluded = ['CONCLUIDA', 'FINALIZADA', 'REALIZADA'].includes(statusUpper);
      
      // Parsear os sets na perspectiva do usuário
      let parsedSets: { myGames: number; oppGames: number }[] = [];
      const dbSets = m.partida_sets || [];
      if (dbSets.length > 0) {
        parsedSets = dbSets
          .slice()
          .sort((a: any, b: any) => (a.numero_set || 0) - (b.numero_set || 0))
          .map((s: any) => {
            const g1 = Number(s.jogador_1_games || 0);
            const g2 = Number(s.jogador_2_games || 0);
            return {
              myGames: isJ1 ? g1 : g2,
              oppGames: isJ1 ? g2 : g1
            };
          });
      } else if (m.detalhes_placar) {
        const rawPlacar = String(m.detalhes_placar).trim();
        const chunks = rawPlacar.split(/[,;\n]+/).map((c) => c.trim()).filter(Boolean);
        chunks.forEach((chunk) => {
          const matchRegex = chunk.match(/(\d+)\s*[/xX×\-–—]\s*(\d+)/);
          if (matchRegex) {
            const g1 = parseInt(matchRegex[1], 10);
            const g2 = parseInt(matchRegex[2], 10);
            parsedSets.push({
              myGames: isJ1 ? g1 : g2,
              oppGames: isJ1 ? g2 : g1
            });
          }
        });
      }

      // Determinar vitória / derrota
      let isWinner = false;
      let hasConfirmedWinner = false;

      if (m.vencedor_id) {
        isWinner = m.vencedor_id === userId;
        hasConfirmedWinner = true;
      } else if (isStatusConcluded && parsedSets.length > 0) {
        let setsWonCount = 0;
        let setsLostCount = 0;
        parsedSets.forEach((s) => {
          if (s.myGames > s.oppGames) setsWonCount++;
          else if (s.oppGames > s.myGames) setsLostCount++;
        });
        if (setsWonCount > setsLostCount) {
          isWinner = true;
          hasConfirmedWinner = true;
        } else if (setsLostCount > setsWonCount) {
          isWinner = false;
          hasConfirmedWinner = true;
        }
      }

      // Somente entra nas estatísticas esportivas se for concluída e tiver vencedor confirmado
      if (isStatusConcluded || hasConfirmedWinner) {
        partidasConcluidas++;

        if (isWinner) {
          vitorias++;
        } else {
          derrotas++;
        }

        // Estatística por classe do adversário
        if (opponentClass && classStatsMap[opponentClass]) {
          if (isWinner) classStatsMap[opponentClass].vitorias++;
          else classStatsMap[opponentClass].derrotas++;
        }

        // Sets e games (apenas válidos com pontuação)
        parsedSets.forEach((s) => {
          if (s.myGames > 0 || s.oppGames > 0) {
            gamesVencidos += s.myGames;
            gamesPerdidos += s.oppGames;

            if (s.myGames > s.oppGames) {
              setsVencidos++;
            } else if (s.oppGames > s.myGames) {
              setsPerdidos++;
            }
          }
        });

        // Desempenho Anual por Mês
        const dateRaw = m.finalizado_em || m.reserva?.data || m.criado_em;
        const matchDate = new Date(dateRaw);
        if (!isNaN(matchDate.getTime()) && matchDate.getFullYear() === currentYear) {
          const monthIdx = matchDate.getMonth();
          if (monthIdx >= 0 && monthIdx < 12) {
            mesesStats[monthIdx].total++;
            if (isWinner) mesesStats[monthIdx].vitorias++;
            else mesesStats[monthIdx].derrotas++;
          }
        }

        concludedMatchesWithWinner.push({
          match: m,
          isWinner,
          date: dateRaw || ''
        });
      }
    });

    // 3. Cálculo de Sequências (Ordenação cronológica)
    concludedMatchesWithWinner.sort((a, b) => {
      const tA = new Date(a.date).getTime() || 0;
      const tB = new Date(b.date).getTime() || 0;
      if (tA !== tB) return tA - tB;
      return String(a.match.criado_em || '').localeCompare(String(b.match.criado_em || ''));
    });

    let maiorSequencia = 0;
    let streakCount = 0;
    concludedMatchesWithWinner.forEach((item) => {
      if (item.isWinner) {
        streakCount++;
        if (streakCount > maiorSequencia) maiorSequencia = streakCount;
      } else {
        streakCount = 0;
      }
    });

    // Sequência atual: a partir do jogo concluído mais recente
    let sequenciaAtual = 0;
    const reverseChronological = [...concludedMatchesWithWinner].reverse();
    for (const item of reverseChronological) {
      if (item.isWinner) {
        sequenciaAtual++;
      } else {
        break;
      }
    }

    // Últimos 5 e 10 jogos
    const last5 = reverseChronological.slice(0, 5);
    const last10 = reverseChronological.slice(0, 10);
    const vitoriasUltimos5 = last5.filter((i) => i.isWinner).length;
    const vitoriasUltimos10 = last10.filter((i) => i.isWinner).length;

    const totalPartidas = vitorias + derrotas;
    const aproveitamento = totalPartidas > 0 ? Math.round((vitorias / totalPartidas) * 100) : 0;
    const saldoGames = gamesVencidos - gamesPerdidos;

    const porClasse: EstatisticasPorClasse[] = DEFAULT_PLAYER_CLASSES.map((cls) => {
      const stats = classStatsMap[cls] || { vitorias: 0, derrotas: 0 };
      const tot = stats.vitorias + stats.derrotas;
      const simple = cls.replace(/^Classe\s+/i, '').replace(/[()º]/g, '').trim();
      return {
        classe: cls,
        classeSimples: simple,
        vitorias: stats.vitorias,
        derrotas: stats.derrotas,
        total: tot,
        aproveitamento: tot > 0 ? Math.round((stats.vitorias / tot) * 100) : 0
      };
    }).filter((c) => c.total > 0);

    return {
      totalPartidas,
      totalCadastradas,
      partidasAgendadas,
      partidasAguardandoResultado,
      partidasConcluidas,
      vitorias,
      derrotas,
      aproveitamento,
      setsVencidos,
      setsPerdidos,
      gamesVencidos,
      gamesPerdidos,
      saldoGames,
      sequenciaAtual,
      maiorSequenciaVitorias: maiorSequencia,
      vitoriasUltimos5,
      totalUltimos5: last5.length,
      vitoriasUltimos10,
      totalUltimos10: last10.length,
      porClasse,
      desempenhoAnual: mesesStats
    };
  },

  async getHeadToHead(userId: string, opponentId: string, groupId: string): Promise<ConfrontoDireto | null> {
    const db = requireDb();

    if (!userId || !opponentId || userId === opponentId) return null;

    // 1. Carregar dados do adversário
    const { data: oppUser, error: oppErr } = await db
      .from('usuarios')
      .select('*')
      .eq('id', opponentId)
      .single();

    if (oppErr || !oppUser) return null;

    // 2. Carregar classe do adversário no grupo
    const { data: oppMember } = await db
      .from('membros_grupo')
      .select('classe')
      .eq('grupo_id', groupId)
      .eq('usuario_id', opponentId)
      .maybeSingle();

    const opponentClass = oppMember?.classe ? classFromDb(oppMember.classe) : undefined;

    // 3. Carregar todas as partidas diretas entre os dois jogadores no grupo
    const { data: rawMatches, error: matchErr } = await db
      .from('partidas')
      .select(`
        *,
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        vencedor:usuarios!partidas_vencedor_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*)),
        partida_sets(*)
      `)
      .eq('grupo_id', groupId)
      .or(
        `and(jogador_1_id.eq.${userId},jogador_2_id.eq.${opponentId}),and(jogador_1_id.eq.${opponentId},jogador_2_id.eq.${userId})`
      )
      .order('criado_em', { ascending: false });

    if (matchErr) {
      console.error('[getHeadToHead Error]:', matchErr);
      fail('Erro ao carregar confronto direto', matchErr);
    }

    // Deduplicação por ID
    const matchMap = new Map<string, any>();
    (rawMatches || []).forEach((m: any) => {
      if (m && m.id && !matchMap.has(m.id)) matchMap.set(m.id, m);
    });
    const matches = Array.from(matchMap.values());

    let vitoriasUsuario = 0;
    let vitoriasAdversario = 0;
    let setsVencidosUsuario = 0;
    let setsVencidosAdversario = 0;
    let gamesGanhosUsuario = 0;
    let gamesGanhosAdversario = 0;

    const ultimosConfrontos: ConfrontoPartidaResumo[] = [];

    matches.forEach((m: any) => {
      const statusUpper = String(m.status || '').toUpperCase().trim();
      const isStatusConcluded = ['CONCLUIDA', 'FINALIZADA', 'REALIZADA'].includes(statusUpper);
      const isJ1 = m.jogador_1_id === userId;

      // Parsear sets
      let sets: { numero: number; myGames: number; oppGames: number; label: string }[] = [];
      const dbSets = m.partida_sets || [];
      if (dbSets.length > 0) {
        sets = dbSets
          .slice()
          .sort((a: any, b: any) => (a.numero_set || 0) - (b.numero_set || 0))
          .map((s: any, idx: number) => {
            const g1 = Number(s.jogador_1_games || 0);
            const g2 = Number(s.jogador_2_games || 0);
            const myGames = isJ1 ? g1 : g2;
            const oppGames = isJ1 ? g2 : g1;
            return {
              numero: s.numero_set || idx + 1,
              myGames,
              oppGames,
              label: `${myGames} × ${oppGames}`
            };
          });
      } else if (m.detalhes_placar) {
        const rawPlacar = String(m.detalhes_placar).trim();
        const chunks = rawPlacar.split(/[,;\n]+/).map((c) => c.trim()).filter(Boolean);
        chunks.forEach((chunk, idx) => {
          const matchRegex = chunk.match(/(\d+)\s*[/xX×\-–—]\s*(\d+)/);
          if (matchRegex) {
            const g1 = parseInt(matchRegex[1], 10);
            const g2 = parseInt(matchRegex[2], 10);
            const myGames = isJ1 ? g1 : g2;
            const oppGames = isJ1 ? g2 : g1;
            sets.push({
              numero: idx + 1,
              myGames,
              oppGames,
              label: `${myGames} × ${oppGames}`
            });
          }
        });
      }

      // Determinar vitória
      let vitoriaUsuario = false;
      let hasWinner = false;
      if (m.vencedor_id) {
        vitoriaUsuario = m.vencedor_id === userId;
        hasWinner = true;
      } else if (isStatusConcluded && sets.length > 0) {
        let won = 0;
        let lost = 0;
        sets.forEach((s) => {
          if (s.myGames > s.oppGames) won++;
          else if (s.oppGames > s.myGames) lost++;
        });
        if (won > lost) {
          vitoriaUsuario = true;
          hasWinner = true;
        } else if (lost > won) {
          vitoriaUsuario = false;
          hasWinner = true;
        }
      }

      const isWO = String(m.detalhes_placar || '').toUpperCase().includes('W.O.') || String(m.detalhes_placar || '').toUpperCase().includes('WO');

      if (isStatusConcluded || hasWinner) {
        if (vitoriaUsuario) vitoriasUsuario++;
        else vitoriasAdversario++;

        sets.forEach((s) => {
          gamesGanhosUsuario += s.myGames;
          gamesGanhosAdversario += s.oppGames;
          if (s.myGames > s.oppGames) setsVencidosUsuario++;
          else if (s.oppGames > s.myGames) setsVencidosAdversario++;
        });

        const dateFormatted = m.reserva?.data ? formatBrDate(m.reserva.data) : (m.finalizado_em ? formatBrDate(formatCivilDate(m.finalizado_em)) : (m.criado_em ? formatBrDate(formatCivilDate(m.criado_em)) : ''));
        const quadraFormatted = m.reserva?.quadra?.nome || (m.reserva?.quadra_numero ? `Quadra ${m.reserva.quadra_numero}` : 'Quadra Principal');
        const placarFormatted = sets.length > 0 ? sets.map((s) => s.label).join(' · ') : (m.detalhes_placar || (isWO ? 'W.O.' : 'Concluída'));

        ultimosConfrontos.push({
          id: m.id,
          dataTexto: dateFormatted,
          quadraTexto: quadraFormatted,
          placarTexto: placarFormatted,
          sets,
          vitoriaUsuario,
          isWO
        });
      }
    });

    const totalPartidas = vitoriasUsuario + vitoriasAdversario;
    const aproveitamentoUsuario = totalPartidas > 0 ? Math.round((vitoriasUsuario / totalPartidas) * 100) : 0;
    const aproveitamentoAdversario = totalPartidas > 0 ? Math.round((vitoriasAdversario / totalPartidas) * 100) : 0;
    const saldoGamesUsuario = gamesGanhosUsuario - gamesGanhosAdversario;

    return {
      adversario: mapUser(oppUser),
      adversarioClasse: opponentClass,
      totalPartidas,
      vitoriasUsuario,
      vitoriasAdversario,
      aproveitamentoUsuario,
      aproveitamentoAdversario,
      setsVencidosUsuario,
      setsVencidosAdversario,
      gamesGanhosUsuario,
      gamesGanhosAdversario,
      saldoGamesUsuario,
      ultimosConfrontos
    };
  },

  async getGroupRanking(groupId: string): Promise<RankingJogador[]> {
    const db = requireDb();

    // 1. Obter membros ativos do grupo
    const { data: members, error: memErr } = await db
      .from('membros_grupo')
      .select('*, usuario:usuarios(*)')
      .eq('grupo_id', groupId)
      .eq('status', 'ativo');

    if (memErr) fail('Erro ao carregar ranking do grupo', memErr);

    // 2. Obter todas as partidas concluídas do grupo
    const { data: matches, error: matchErr } = await db
      .from('partidas')
      .select('id, jogador_1_id, jogador_2_id, vencedor_id, status')
      .eq('grupo_id', groupId)
      .in('status', ['FINALIZADA', 'CONCLUIDA', 'REALIZADA']);

    if (matchErr) fail('Erro ao carregar histórico para o ranking', matchErr);

    const statsByUser: Record<string, { partidas: number; vitorias: number; derrotas: number }> = {};
    (members || []).forEach((m: any) => {
      statsByUser[m.usuario_id] = { partidas: 0, vitorias: 0, derrotas: 0 };
    });

    (matches || []).forEach((m: any) => {
      if (statsByUser[m.jogador_1_id]) {
        statsByUser[m.jogador_1_id].partidas++;
        if (m.vencedor_id === m.jogador_1_id) statsByUser[m.jogador_1_id].vitorias++;
        else if (m.vencedor_id === m.jogador_2_id) statsByUser[m.jogador_1_id].derrotas++;
      }
      if (statsByUser[m.jogador_2_id]) {
        statsByUser[m.jogador_2_id].partidas++;
        if (m.vencedor_id === m.jogador_2_id) statsByUser[m.jogador_2_id].vitorias++;
        else if (m.vencedor_id === m.jogador_1_id) statsByUser[m.jogador_2_id].derrotas++;
      }
    });

    const rankingItems: RankingJogador[] = (members || [])
      .filter((m: any) => m.usuario)
      .map((m: any) => {
        const stats = statsByUser[m.usuario_id] || { partidas: 0, vitorias: 0, derrotas: 0 };
        const aproveitamento = stats.partidas > 0 ? Math.round((stats.vitorias / stats.partidas) * 100) : 0;
        // Sistema de pontos: 3 pontos por vitória, 1 ponto por partida jogada
        const pontos = stats.vitorias * 3 + stats.partidas * 1;

        return {
          posicao: 0,
          usuario: mapUser(m.usuario),
          membro: mapMember(m),
          classe: classFromDb(m.classe),
          partidas: stats.partidas,
          vitorias: stats.vitorias,
          derrotas: stats.derrotas,
          aproveitamento,
          pontos
        };
      });

    // Ordenar por pontos DESC, vitorias DESC, aproveitamento DESC, nome ASC
    rankingItems.sort((a, b) => {
      if (b.pontos !== a.pontos) return b.pontos - a.pontos;
      if (b.vitorias !== a.vitorias) return b.vitorias - a.vitorias;
      if (b.aproveitamento !== a.aproveitamento) return b.aproveitamento - a.aproveitamento;
      return a.usuario.nome.localeCompare(b.usuario.nome);
    });

    // Atribuir posição
    rankingItems.forEach((item, index) => {
      item.posicao = index + 1;
    });

    return rankingItems;
  },

  async getGroupFeed(groupId: string, currentUserId?: string): Promise<FeedItem[]> {
    const db = requireDb();
    const { data: matches, error } = await db
      .from('partidas')
      .select(`
        *,
        jogador_1:usuarios!partidas_jogador_1_id_fkey(*),
        jogador_2:usuarios!partidas_jogador_2_id_fkey(*),
        vencedor:usuarios!partidas_vencedor_id_fkey(*),
        reserva:reservas(*, quadra:quadras(*), horario:horarios(*), criador:usuarios!reservas_criador_id_fkey(*)),
        partida_sets(*),
        partida_curtidas(id, usuario_id)
      `)
      .eq('grupo_id', groupId)
      .eq('status', 'FINALIZADA')
      .order('criado_em', { ascending: false })
      .limit(30);

    if (error) {
      console.error('[Supabase getGroupFeed Error]:', error);
      fail('Erro ao carregar feed do grupo', error);
    }

    const items: FeedItem[] = await Promise.all((matches || []).map(async (row) => {
      const match = await mapMatch(row, currentUserId);
      const j1 = match.jogador_1 || { id: match.jogador_1_id, nome: 'Jogador 1', email: '', whatsapp: '', foto_url: null, created_at: '' };
      const j2 = match.jogador_2 || { id: match.jogador_2_id, nome: 'Jogador 2', email: '', whatsapp: '', foto_url: null, created_at: '' };

      const setsPlacar = match.sets && match.sets.length > 0
        ? match.sets.map((s) => `${s.jogador_1_games}x${s.jogador_2_games}`).join(' · ')
        : match.detalhes_placar || 'Resultado finalizado';

      const dataStr = match.reserva?.data
        ? match.reserva.data.split('-').reverse().join('/')
        : new Date(match.criado_em).toLocaleDateString('pt-BR');

      const quadraStr = match.reserva?.quadra_numero ? `Quadra ${match.reserva.quadra_numero}` : 'Quadra Principal';

      return {
        partida: match,
        autor: j1,
        adversario: j2,
        resultadoTexto: setsPlacar,
        dataTexto: dataStr,
        quadraTexto: quadraStr,
        fotoUrl: match.foto_url,
        curtidas: match.curtidas_count || 0,
        curtidoPeloUsuario: match.usuario_curtiu || false
      };
    }));

    return items;
  },

  async toggleFeedLike(matchId: string, userId: string): Promise<{ liked: boolean; count: number }> {
    const db = requireDb();
    const { data: existing } = await db
      .from('partida_curtidas')
      .select('id')
      .eq('partida_id', matchId)
      .eq('usuario_id', userId)
      .maybeSingle();

    if (existing) {
      await db.from('partida_curtidas').delete().eq('id', existing.id);
    } else {
      await db.from('partida_curtidas').insert({ partida_id: matchId, usuario_id: userId });
    }

    const { count } = await db
      .from('partida_curtidas')
      .select('id', { count: 'exact', head: true })
      .eq('partida_id', matchId);

    return {
      liked: !existing,
      count: count || 0
    };
  }
};
