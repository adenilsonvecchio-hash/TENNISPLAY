export type PerfilRole = 'PROPRIETARIO' | 'ADMINISTRADOR' | 'JOGADOR';

export type MemberStatus = 'PENDENTE' | 'ATIVO' | 'BLOQUEADO';

export type PlayerClass =
  | 'Classe A (1º)'
  | 'Classe B (2º)'
  | 'Classe C (3º)'
  | 'Classe D (4º)'
  | 'Classe E (5º)'
  | 'Classe F (6º)'
  | 'Classe G (7º)'
  | 'Classe Infantil'
  | 'Classe Juvenil'
  | 'Classe (50+)'
  | 'Sem Classe';

export const DEFAULT_PLAYER_CLASSES: PlayerClass[] = [
  'Classe A (1º)',
  'Classe B (2º)',
  'Classe C (3º)',
  'Classe D (4º)',
  'Classe E (5º)',
  'Classe F (6º)',
  'Classe G (7º)',
  'Classe Infantil',
  'Classe Juvenil',
  'Classe (50+)',
];

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  whatsapp: string;
  foto_url?: string | null;
  created_at: string;
}

export interface Grupo {
  id: string;
  nome: string;
  cidade: string;
  estado: string;
  logo_url?: string | null;
  imagem_path?: string | null;
  ativo: boolean;
  created_at: string;
  codigo_convite?: string;
  default_qtd_quadras?: number;
  prazo_cancelamento_horas?: number;
}

export interface MembroGrupo {
  id: string;
  usuario_id: string;
  grupo_id: string;
  perfil: PerfilRole;
  status: MemberStatus;
  classe?: PlayerClass;
  created_at: string;
  // Joined relation fields for convenience
  usuario?: Usuario;
  grupo?: Grupo;
}

export interface TimeSlot {
  id: string;
  inicio: string;
  fim: string;
  label: string;
}

export interface Quadra {
  id: string;
  grupo_id: string;
  numero: number;
  nome: string;
  ativa: boolean;
  dias_funcionamento?: number[]; // [0..6] onde 0=domingo, 4=quinta, etc.
}

export interface CourtConfig {
  id?: string;
  grupo_id: string;
  data: string; // YYYY-MM-DD
  qtd_quadras: number;
  quadras?: Quadra[]; // Lista real das quadras ativas do grupo
  horarios: TimeSlot[];
  prazo_cancelamento_horas: number;
}

export interface Reserva {
  id: string;
  grupo_id: string;
  data: string; // YYYY-MM-DD
  horario_id: string;
  horario_label: string;
  quadra_id?: string;
  quadra_numero: number;
  jogador_id: string;
  jogador_nome: string;
  jogador_classe?: PlayerClass;
  status?: 'aguardando' | 'confirmada' | 'cancelada';
  created_at: string;

  // Informações da partida vinculada e participantes
  partida_id?: string | null;
  partida?: Partida;
  jogador_1_id?: string;
  jogador_2_id?: string;
  jogador_1_nome?: string;
  jogador_1_classe?: PlayerClass;
  jogador_2_nome?: string;
  jogador_2_classe?: PlayerClass;
  adversario_id?: string;
  adversario_nome?: string;
  adversario_classe?: PlayerClass;
}

export type NotificacaoType =
  | 'RESERVA_CONFIRMADA'
  | 'RESERVA_CANCELADA'
  | 'SOLICITACAO_APROVADA'
  | 'SOLICITACAO_RECUSADA'
  | 'CLASSE_ALTERADA'
  | 'PARTIDA_CRIADA'
  | 'DESAFIO_RECEBIDO'
  | 'DESAFIO_ACEITO'
  | 'DESAFIO_RECUSADO'
  | 'RESULTADO_INFORMADO'
  | 'RESULTADO_CONFIRMADO'
  | 'CORRECAO_SOLICITADA';

export type PartidaStatus =
  | 'PENDENTE'
  | 'ACEITA'
  | 'RECUSADA'
  | 'CANCELADA'
  | 'CONCLUIDA'
  | 'AGUARDANDO_ACEITE'
  | 'CONFIRMADA'
  | 'REALIZADA'
  | 'AGUARDANDO_ADV'
  | 'AGUARDANDO_RESULTADO'
  | 'AGUARDANDO_CONFIRMACAO_RESULTADO'
  | 'FINALIZADA';

export const PARTIDA_STATUS = {
  PENDENTE: 'PENDENTE' as const,
  ACEITA: 'ACEITA' as const,
  RECUSADA: 'RECUSADA' as const,
  CANCELADA: 'CANCELADA' as const,
  CONCLUIDA: 'CONCLUIDA' as const,
} as const;

export interface PartidaSet {
  id?: string;
  partida_id?: string;
  numero_set: number;
  jogador_1_games: number;
  jogador_2_games: number;
  created_at?: string;
}

export interface Partida {
  id: string;
  grupo_id: string;
  reserva_id?: string | null;
  jogador_1_id: string;
  jogador_2_id: string;
  status: PartidaStatus;
  resultado_informado_por?: string | null;
  vencedor_id?: string | null;
  foto_path?: string | null;
  foto_url?: string | null;
  detalhes_placar?: string | null;
  criado_em: string;
  finalizado_em?: string | null;
  
  // Relações carregadas
  jogador_1?: Usuario;
  jogador_2?: Usuario;
  jogador_1_classe?: PlayerClass;
  jogador_2_classe?: PlayerClass;
  vencedor?: Usuario;
  reserva?: Reserva;
  sets?: PartidaSet[];
  curtidas_count?: number;
  usuario_curtiu?: boolean;
}

export interface EstatisticasPorClasse {
  classe: PlayerClass;
  classeSimples: string;
  vitorias: number;
  derrotas: number;
  total: number;
  aproveitamento: number;
}

export interface DesempenhoMes {
  mes: string; // "Jan", "Fev", "Mar", etc.
  mesNumero: number; // 1..12
  vitorias: number;
  derrotas: number;
  total: number;
}

export interface EstatisticasJogador {
  totalPartidas: number;
  vitorias: number;
  derrotas: number;
  aproveitamento: number; // 0..100
  setsVencidos: number;
  setsPerdidos: number;
  gamesVencidos: number;
  gamesPerdidos: number;
  saldoGames: number;
  sequenciaAtual: number;
  maiorSequenciaVitorias: number;
  vitoriasUltimos5: number;
  totalUltimos5: number;
  vitoriasUltimos10: number;
  totalUltimos10: number;
  porClasse: EstatisticasPorClasse[];
  desempenhoAnual: DesempenhoMes[];
  rankingPosicao?: number;
}

export interface RankingJogador {
  posicao: number;
  usuario: Usuario;
  membro: MembroGrupo;
  classe: PlayerClass;
  partidas: number;
  vitorias: number;
  derrotas: number;
  aproveitamento: number;
  pontos: number;
}

export interface FeedItem {
  partida: Partida;
  autor: Usuario;
  adversario: Usuario;
  resultadoTexto: string;
  dataTexto: string;
  quadraTexto: string;
  fotoUrl?: string | null;
  curtidas: number;
  curtidoPeloUsuario: boolean;
}

export interface Notificacao {
  id: string;
  grupo_id: string;
  usuario_id: string;
  titulo: string;
  mensagem: string;
  tipo: NotificacaoType;
  lida: boolean;
  created_at: string;
}

export const DEFAULT_HORARIOS_PADRAO: TimeSlot[] = [
  { id: 'h1', inicio: '07:00', fim: '08:30', label: '07:00 às 08:30' },
  { id: 'h2', inicio: '08:30', fim: '10:00', label: '08:30 às 10:00' },
  { id: 'h3', inicio: '10:00', fim: '11:30', label: '10:00 às 11:30' },
  { id: 'h4', inicio: '13:00', fim: '14:30', label: '13:00 às 14:30' },
  { id: 'h5', inicio: '14:30', fim: '16:00', label: '14:30 às 16:00' },
  { id: 'h6', inicio: '16:00', fim: '17:30', label: '16:00 às 17:30' },
  { id: 'h7', inicio: '17:30', fim: '19:00', label: '17:30 às 19:00' },
  { id: 'h8', inicio: '19:00', fim: '20:30', label: '19:00 às 20:30' },
];

export interface CadastroProprietarioData {
  nome: string;
  email: string;
  whatsapp: string;
  senha: string;
  confirmarSenha: string;
  nomeGrupo: string;
  cidade: string;
  estado: string;
}

export interface CadastroJogadorData {
  nome: string;
  email: string;
  whatsapp: string;
  senha: string;
  confirmarSenha: string;
  codigoGrupo?: string;
}

export interface AuthSession {
  user: Usuario | null;
  activeGroup: Grupo | null;
  activeRole: PerfilRole | null;
  membros: MembroGrupo[];
}

/**
 * Regra de Segurança Centralizada:
 * Somente o PROPRIETÁRIO do grupo pode definir ou alterar a classe de qualquer jogador.
 * Administradores e jogadores comuns não possuem permissão para alterar classes.
 */
export function podeAlterarClasse(session: AuthSession | null): boolean {
  if (!session || !session.user || !session.activeGroup) return false;
  const currentMember = session.membros.find(
    (m) => m.usuario_id === session.user?.id && m.grupo_id === session.activeGroup?.id
  );
  return currentMember?.perfil === 'PROPRIETARIO' && currentMember?.status === 'ATIVO';
}


export interface BrazilianState {
  sigla: string;
  nome: string;
}

export const ESTADOS_BRASIL: BrazilianState[] = [
  { sigla: 'AC', nome: 'Acre' },
  { sigla: 'AL', nome: 'Alagoas' },
  { sigla: 'AP', nome: 'Amapá' },
  { sigla: 'AM', nome: 'Amazonas' },
  { sigla: 'BA', nome: 'Bahia' },
  { sigla: 'CE', nome: 'Ceará' },
  { sigla: 'DF', nome: 'Distrito Federal' },
  { sigla: 'ES', nome: 'Espírito Santo' },
  { sigla: 'GO', nome: 'Goiás' },
  { sigla: 'MA', nome: 'Maranhão' },
  { sigla: 'MT', nome: 'Mato Grosso' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul' },
  { sigla: 'MG', nome: 'Minas Gerais' },
  { sigla: 'PA', nome: 'Pará' },
  { sigla: 'PB', nome: 'Paraíba' },
  { sigla: 'PR', nome: 'Paraná' },
  { sigla: 'PE', nome: 'Pernambuco' },
  { sigla: 'PI', nome: 'Piauí' },
  { sigla: 'RJ', nome: 'Rio de Janeiro' },
  { sigla: 'RN', nome: 'Rio Grande do Norte' },
  { sigla: 'RS', nome: 'Rio Grande do Sul' },
  { sigla: 'RO', nome: 'Rondônia' },
  { sigla: 'RR', nome: 'Roraima' },
  { sigla: 'SC', nome: 'Santa Catarina' },
  { sigla: 'SP', nome: 'São Paulo' },
  { sigla: 'SE', nome: 'Sergipe' },
  { sigla: 'TO', nome: 'Tocantins' }
];
