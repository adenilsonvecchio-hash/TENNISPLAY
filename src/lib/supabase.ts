import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_URL || '').trim() : '';
const supabaseKey = typeof import.meta !== 'undefined' && import.meta.env ? (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim() : '';

// Validar se ambas as variáveis de ambiente existem e estão no formato correto antes de inicializar o cliente
export const isSupabaseConfigured = (): boolean => {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseKey) &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) &&
    supabaseKey.length > 0
  );
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null;

export const getSupabaseClient = (): SupabaseClient | null => supabase;

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

