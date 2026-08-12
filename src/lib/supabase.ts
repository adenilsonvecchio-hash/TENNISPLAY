import { createClient } from '@supabase/supabase-js';

const getEnvVar = (name: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[name]) {
    return String(import.meta.env[name]);
  }
  if (typeof process !== 'undefined' && process.env && process.env[name]) {
    return String(process.env[name]);
  }
  return '';
};

const rawUrl = getEnvVar('VITE_SUPABASE_URL').trim();
const matchUrl = rawUrl.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i);
const url = matchUrl ? matchUrl[0] : rawUrl.replace(/\/rest\/v1\/?$/i, '').replace(/\/$/, '');

const pubKey = getEnvVar('VITE_SUPABASE_PUBLISHABLE_KEY').trim();
const anonKey = getEnvVar('VITE_SUPABASE_ANON_KEY').trim();
const rawKey = pubKey || anonKey;
const key = rawKey
  .replace(/^(VITE_SUPABASE_PUBLISHABLE_KEY|VITE_SUPABASE_ANON_KEY)\s+/i, '')
  .replace(/^['"]|['"]$/g, '')
  .trim();

export const isSupabaseConfigured = () =>
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && key.length > 0;

export const supabase = isSupabaseConfigured()
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const getSupabaseClient = () => supabase;

export interface SupabaseTestResult {
  success: boolean;
  type: 'valid_connection' | 'key_error' | 'rls_block' | 'missing_table' | 'network_error';
  message: string;
  details?: string;
  status?: number;
}

export const diagnoseSupabaseConnection = async (): Promise<SupabaseTestResult> => {
  if (!supabase) {
    return {
      success: false,
      type: 'key_error',
      message: 'Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY ausentes ou inválidas.'
    };
  }

  try {
    const { data, error, status } = await supabase
      .from('grupos')
      .select('id')
      .limit(1);

    if (!error) {
      return {
        success: true,
        type: 'valid_connection',
        message: 'Conexão válida e consulta realizada com sucesso.',
        status
      };
    }

    const msg = error.message || '';
    const code = error.code || '';

    if (status === 401 || msg.toLowerCase().includes('api key') || msg.toLowerCase().includes('invalid key')) {
      return {
        success: false,
        type: 'key_error',
        message: 'Erro de chave de API (Invalid API Key). Verifique a VITE_SUPABASE_PUBLISHABLE_KEY em Secrets.',
        details: msg,
        status
      };
    }

    if (code === '42501' || msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('row-level security') || msg.toLowerCase().includes('rls')) {
      return {
        success: false,
        type: 'rls_block',
        message: 'Conexão realizada, mas acesso bloqueado por políticas de RLS (Row-Level Security).',
        details: msg,
        status
      };
    }

    if (status === 404 || code === '42P01' || code === 'PGRST205' || msg.toLowerCase().includes('relation') || msg.toLowerCase().includes('does not exist') || msg.toLowerCase().includes('schema cache')) {
      return {
        success: false,
        type: 'missing_table',
        message: 'Conexão realizada e chave aceita, porém a tabela "grupos" não existe no banco de dados.',
        details: msg,
        status
      };
    }

    return {
      success: false,
      type: 'network_error',
      message: `Erro na comunicação com Supabase: ${msg}`,
      details: error.details || msg,
      status
    };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      type: 'network_error',
      message: `Falha técnica de conexão: ${errMsg}`,
      details: errMsg
    };
  }
};

export const testSupabaseConnection = async (): Promise<void> => {
  const diag = await diagnoseSupabaseConnection();
  if (!diag.success) {
    throw new Error(diag.message);
  }
};

