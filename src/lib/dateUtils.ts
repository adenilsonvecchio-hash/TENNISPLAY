/**
 * TennisPlay - Utilitários de Data Civil e Fuso Horário
 * Garante que datas sejam manipuladas estritamente no fuso civil do clube (America/Sao_Paulo)
 * sem distorções de conversão UTC (YYYY-MM-DD).
 */

const DIAS_SEMANA_NOMES = [
  'Domingo',
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado'
];

const DIAS_SEMANA_SIGLAS = [
  'DOM.',
  'SEG.',
  'TER.',
  'QUA.',
  'QUI.',
  'SEX.',
  'SÁB.'
];

/**
 * Retorna a data civil atual no formato YYYY-MM-DD
 */
export function getTodayCivilDate(): string {
  const now = new Date();
  // Usa o fuso de Brasília para determinar a data civil de hoje
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(now); // Retorna YYYY-MM-DD
  } catch {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Quebra explicitamente a data civil YYYY-MM-DD em ano, mês e dia
 */
export function parseCivilDate(dateStr: string): { year: number; month: number; day: number } {
  if (!dateStr || !dateStr.includes('-')) {
    const today = getTodayCivilDate();
    const [y, m, d] = today.split('-').map(Number);
    return { year: y, month: m, day: d };
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y || 2026, month: m || 1, day: d || 1 };
}

/**
 * Retorna o dia da semana no padrão JavaScript e PostgreSQL (0 = Domingo, 4 = Quinta, 6 = Sábado)
 */
export function getDayOfWeek(dateStr: string): number {
  const { year, month, day } = parseCivilDate(dateStr);
  // Construtor com ano, mês (0-indexado) e dia local nunca sofre offset UTC
  const dateObj = new Date(year, month - 1, day, 12, 0, 0);
  return dateObj.getDay();
}

/**
 * Retorna o nome por extenso do dia da semana (ex: 'Quinta-feira')
 */
export function getDayOfWeekName(dateStr: string): string {
  const dow = getDayOfWeek(dateStr);
  return DIAS_SEMANA_NOMES[dow] || 'Quinta-feira';
}

/**
 * Retorna a sigla do dia da semana (ex: 'QUI.')
 */
export function getDayOfWeekSigla(dateStr: string): string {
  const dow = getDayOfWeek(dateStr);
  return DIAS_SEMANA_SIGLAS[dow] || 'QUI.';
}

/**
 * Formata a data para exibição elegante no padrão brasileiro: DD/MM/YYYY (QUI.)
 */
export function formatDisplayDate(dateStr: string): string {
  const { year, month, day } = parseCivilDate(dateStr);
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  const y = String(year);
  const sigla = getDayOfWeekSigla(dateStr);
  return `${d}/${m}/${y} (${sigla})`;
}

/**
 * Formata apenas a data brasileira: DD/MM/YYYY
 */
export function formatBrDate(dateStr: string): string {
  const { year, month, day } = parseCivilDate(dateStr);
  const d = String(day).padStart(2, '0');
  const m = String(month).padStart(2, '0');
  const y = String(year);
  return `${d}/${m}/${y}`;
}

/**
 * Converte um objeto Date ou string de data para a data civil YYYY-MM-DD
 */
export function formatCivilDate(date: Date | string): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parts = date.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(parts)) return parts;
  }
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return getTodayCivilDate();
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(dateObj);
  } catch {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Verifica de forma consistente se a quadra está disponível em uma data civil específica
 */
export function isCourtAvailableOnDate(
  quadra?: { ativa?: boolean; dias_funcionamento?: number[] } | null,
  dateStr?: string
): boolean {
  if (!quadra || quadra.ativa === false) return false;
  if (!dateStr) return true;
  const dow = getDayOfWeek(dateStr);
  if (!quadra.dias_funcionamento || quadra.dias_funcionamento.length === 0) {
    return true; // Se não especificado, todos os dias (0..6) estão disponíveis
  }
  return quadra.dias_funcionamento.includes(dow);
}

/**
 * Retorna o horário civil atual no formato HH:MM (ex: "14:10") no fuso de Brasília (America/Sao_Paulo)
 */
export function getCurrentCivilTime(): string {
  const now = new Date();
  try {
    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return formatter.format(now);
  } catch {
    const h = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    return `${h}:${min}`;
  }
}

/**
 * Retorna se uma data civil é estritamente anterior a hoje (YYYY-MM-DD)
 */
export function isPastCivilDate(dateStr: string): boolean {
  const today = getTodayCivilDate();
  const normDate = formatCivilDate(dateStr);
  return normDate < today;
}

/**
 * Verifica se um horário específico em uma data já passou / começou.
 * - Se data for anterior a hoje: true (passado)
 * - Se data for posterior a hoje: false (futuro)
 * - Se data for hoje: compara hora_inicio (ex: "10:00") com o horário civil atual (ex: "14:10")
 */
export function isPastTimeSlot(dateStr: string, startTimeStr?: string | null): boolean {
  const today = getTodayCivilDate();
  const normDate = formatCivilDate(dateStr);

  if (normDate < today) return true;
  if (normDate > today) return false;

  // Mesmo dia: extrair HH:MM
  if (!startTimeStr) return false;
  let cleanTime = startTimeStr.trim();
  if (cleanTime.includes('às')) {
    cleanTime = cleanTime.split('às')[0].trim();
  }
  if (cleanTime.length >= 5) {
    cleanTime = cleanTime.slice(0, 5);
  }

  const currentTime = getCurrentCivilTime();
  return cleanTime <= currentTime;
}

/**
 * Soma ou subtrai dias de uma data civil sem conversão indevida para UTC
 */
export function addDaysCivil(dateStr: string, offsetDays: number): string {
  const { year, month, day } = parseCivilDate(dateStr);
  const current = new Date(year, month - 1, day, 12, 0, 0);
  current.setDate(current.getDate() + offsetDays);

  const y = current.getFullYear();
  const m = String(current.getMonth() + 1).padStart(2, '0');
  const d = String(current.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
