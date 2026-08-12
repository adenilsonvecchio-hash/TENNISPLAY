import React, { useState, useEffect } from 'react';
import { AuthSession, Notificacao } from '../types';
import { DbService } from '../lib/db';
import { Bell, Check, CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';

interface NotificationCenterProps {
  session: AuthSession;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ session }) => {
  const { user, activeGroup } = session;
  const [notifications, setNotifications] = useState<Notificacao[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!user || !activeGroup) return;
    DbService.getUserNotifications(user.id, activeGroup.id).then((notifs) => {
      setNotifications(notifs);
    });
  }, [user?.id, activeGroup?.id, isOpen]);

  if (!user || !activeGroup) return null;

  const unreadCount = notifications.filter(n => !n.lida).length;

  const handleMarkAsRead = async (id: string) => {
    await DbService.markNotificationRead(id);
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, lida: true } : n))
    );
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `Há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Há ${hours} h`;
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notificações"
        className="relative w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-slate-900 shrink-0 cursor-pointer"
        title="Notificações"
      >
        <Bell className="w-4 h-4 text-slate-800" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4.5 h-4.5 bg-rose-600 text-white rounded-full text-[9px] font-black flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-3xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm">Notificações</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                  {unreadCount} nova(s)
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-600 underline font-medium"
            >
              Fechar
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                Nenhuma notificação no momento.
              </div>
            ) : (
              notifications.map((n) => {
                let icon = <Sparkles className="w-4 h-4 text-emerald-600" />;
                if (n.tipo === 'RESERVA_CONFIRMADA') icon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
                if (n.tipo === 'RESERVA_CANCELADA') icon = <XCircle className="w-4 h-4 text-rose-600" />;
                if (n.tipo === 'SOLICITACAO_APROVADA') icon = <CheckCircle2 className="w-4 h-4 text-emerald-600" />;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleMarkAsRead(n.id)}
                    className={`p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                      n.lida ? 'bg-white opacity-75' : 'bg-emerald-50/40 font-semibold'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs shrink-0 mt-0.5">
                      {icon}
                    </div>

                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold text-slate-900">{n.titulo}</h5>
                        <span className="text-[10px] font-medium text-slate-400">
                          {formatTimeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 font-normal leading-relaxed">
                        {n.mensagem}
                      </p>
                    </div>

                    {!n.lida && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 mt-2" />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
