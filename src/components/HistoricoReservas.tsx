import React, { useState, useEffect } from 'react';
import { AuthSession, Reserva } from '../types';
import { DbService } from '../lib/db';
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  XCircle,
  Filter,
  Search,
  Building2,
  Trash2
} from 'lucide-react';

interface HistoricoReservasProps {
  session: AuthSession;
  onRefreshSession?: () => void;
}

export const HistoricoReservas: React.FC<HistoricoReservasProps> = ({ session, onRefreshSession }) => {
  const { user, activeGroup, activeRole } = session;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [bookings, setBookings] = useState<Reserva[]>([]);

  const isAdmin = activeRole === 'PROPRIETARIO' || activeRole === 'ADMINISTRADOR';

  const refreshList = React.useCallback(async () => {
    if (!user || !activeGroup) return;
    const updated = isAdmin
      ? await DbService.getAllGroupBookings(activeGroup.id)
      : await DbService.getUserBookingsAll(user.id, activeGroup.id);
    setBookings(updated);
    if (onRefreshSession) onRefreshSession();
  }, [user?.id, activeGroup?.id, isAdmin, onRefreshSession]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  if (!user || !activeGroup) return null;

  // Filtered list
  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      (b.jogador_nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.horario_label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `quadra ${b.quadra_numero}`.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesDate = !filterDate || b.data === filterDate;

    return matchesSearch && matchesDate;
  });

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Deseja realmente cancelar este agendamento?')) return;
    try {
      await DbService.cancelBooking(bookingId, user.id, activeRole || 'JOGADOR');
      alert('Reserva cancelada com sucesso.');
      await refreshList();
    } catch (err: any) {
      alert(err.message || 'Erro ao cancelar.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      
      {/* HEADER CARD */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-slate-700" />
            <span>Histórico de Reservas</span>
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            {isAdmin
              ? `Todas as reservas realizadas no grupo ${activeGroup.nome}`
              : `Seu histórico pessoal de reservas no grupo ${activeGroup.nome}`}
          </p>
        </div>

        <span className="px-4 py-2 rounded-2xl bg-slate-100 text-slate-800 border border-slate-200 font-black text-xs">
          {filteredBookings.length} {filteredBookings.length === 1 ? 'Registro' : 'Registros'}
        </span>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
          <input
            type="text"
            placeholder="Pesquisar por quadra, jogador ou horário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 cursor-pointer"
          />
          {filterDate && (
            <button
              onClick={() => setFilterDate('')}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* RESERVATIONS TABLE / LIST */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <p className="font-bold text-sm">Nenhuma reserva encontrada no histórico.</p>
            <p className="text-xs">Tente ajustar os filtros de busca ou selecione outra data.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredBookings.map((booking) => {
              const isTodayOrFuture = new Date(booking.data + 'T23:59:59').getTime() >= Date.now();
              const isMine = booking.jogador_id === user.id;

              return (
                <div
                  key={booking.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 ${
                        isMine
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-800'
                      }`}
                    >
                      Q{booking.quadra_numero}
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-black text-slate-900 text-sm sm:text-base">
                          Quadra {booking.quadra_numero}
                        </span>
                        <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                          {booking.horario_label}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-medium flex items-center gap-2">
                        <span>📅 Data: {booking.data}</span>
                        {isAdmin && (
                          <span className="font-bold text-slate-700">
                            • Jogador: {booking.jogador_nome}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {/* Status badge */}
                    {isTodayOrFuture ? (
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                        Confirmado
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        Concluído
                      </span>
                    )}

                    {/* Actions */}
                    {(isMine || isAdmin) && isTodayOrFuture && (
                      <button
                        onClick={() => handleCancelBooking(booking.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center gap-1 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Cancelar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};
