import React, { useEffect, useState } from 'react';
import { CheckCircle2, Database, XCircle } from 'lucide-react';
import { diagnoseSupabaseConnection, isSupabaseConfigured, SupabaseTestResult } from '../lib/supabase';

export function SupabaseConfigModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'error'>(
    isSupabaseConfigured() ? 'checking' : 'error'
  );
  const [message, setMessage] = useState('Verificando conexão...');
  const [diagInfo, setDiagInfo] = useState<SupabaseTestResult | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setMessage('As variáveis do Supabase não foram configuradas no ambiente de publicação.');
      return;
    }
    diagnoseSupabaseConnection().then((diag) => {
      setDiagInfo(diag);
      if (diag.success) {
        setStatus('ok');
        setMessage('Conexão válida e comunicação com o Supabase confirmada.');
      } else {
        setStatus('error');
        setMessage(diag.message);
      }
    });
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-slate-100 p-3 text-slate-900"><Database /></div>
          <div><h2 className="text-xl font-black text-slate-900">Banco de dados</h2><p className="text-sm text-slate-500">Supabase central</p></div>
        </div>
        <div className={`mt-6 flex flex-col gap-2 rounded-2xl p-4 ${status === 'ok' ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
          <div className="flex items-center gap-3">
            {status === 'ok' ? <CheckCircle2 className="shrink-0 text-emerald-600" /> : <XCircle className="shrink-0 text-rose-600" />}
            <p className="text-sm font-semibold">{message}</p>
          </div>
          {diagInfo && diagInfo.details && (
            <p className="mt-1 text-xs font-mono opacity-80 break-words">{diagInfo.details}</p>
          )}
        </div>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">A URL e a chave pública são definidas nas variáveis de ambiente. Elas não ficam salvas neste aparelho.</p>
        <button onClick={onClose} className="mt-6 w-full rounded-xl bg-slate-900 px-4 py-3 font-bold text-white hover:bg-slate-800">Fechar</button>
      </div>
    </div>
  );
}

