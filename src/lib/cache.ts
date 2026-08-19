/**
 * Safe Local Cache Manager for TennisPlay
 * Segrega dados estritamente por usuario_id e grupo_id.
 * Permite renderização imediata do AppShell e dos dados em < 500ms (Padrão LetsPlay).
 */

import { AuthSession, CourtConfig, Grupo, MembroGrupo, Notificacao, Partida, RankingJogador, Reserva, Usuario } from '../types';

const SESSION_CACHE_KEY = 'tp_session_cache_v1';
const CACHE_PREFIX = 'tp_cache_v1';

export interface CachedEnvelope<T> {
  data: T;
  timestamp: number;
  userId?: string;
  groupId?: string;
}

export const LocalCache = {
  // 1. Session Caching
  getCachedSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(SESSION_CACHE_KEY);
      if (!raw) return null;
      const parsed: CachedEnvelope<AuthSession> = JSON.parse(raw);
      if (parsed && parsed.data && parsed.data.user && parsed.data.user.id) {
        return parsed.data;
      }
      return null;
    } catch (e) {
      console.warn('[Cache] Erro ao recuperar sessão em cache:', e);
      return null;
    }
  },

  setCachedSession(session: AuthSession | null): void {
    try {
      if (!session || !session.user) {
        localStorage.removeItem(SESSION_CACHE_KEY);
      } else {
        const envelope: CachedEnvelope<AuthSession> = {
          data: session,
          timestamp: Date.now(),
          userId: session.user.id,
          groupId: session.activeGroup?.id
        };
        localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(envelope));
      }
    } catch (e) {
      console.warn('[Cache] Erro ao salvar sessão em cache:', e);
    }
  },

  // 2. Generic Scoped Caching
  getScopedKey(type: string, userId?: string, groupId?: string): string {
    const u = userId || 'anonymous';
    const g = groupId || 'global';
    return `${CACHE_PREFIX}_${u}_${g}_${type}`;
  },

  get<T>(type: string, userId?: string, groupId?: string): { data: T; timestamp: number } | null {
    try {
      const key = this.getScopedKey(type, userId, groupId);
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed: CachedEnvelope<T> = JSON.parse(raw);
      if (!parsed || parsed.data === undefined) return null;
      return { data: parsed.data, timestamp: parsed.timestamp };
    } catch (e) {
      console.warn(`[Cache] Erro ao ler item ${type}:`, e);
      return null;
    }
  },

  set<T>(type: string, data: T, userId?: string, groupId?: string): void {
    try {
      const key = this.getScopedKey(type, userId, groupId);
      const envelope: CachedEnvelope<T> = {
        data,
        timestamp: Date.now(),
        userId,
        groupId
      };
      localStorage.setItem(key, JSON.stringify(envelope));
    } catch (e) {
      console.warn(`[Cache] Erro ao salvar item ${type}:`, e);
    }
  },

  remove(type: string, userId?: string, groupId?: string): void {
    try {
      const key = this.getScopedKey(type, userId, groupId);
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`[Cache] Erro ao remover item ${type}:`, e);
    }
  },

  // 3. Clear private data on logout
  clearUserPrivateData(userId?: string): void {
    try {
      localStorage.removeItem(SESSION_CACHE_KEY);
      if (typeof window === 'undefined') return;

      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(CACHE_PREFIX)) {
          if (!userId || k.includes(`_${userId}_`)) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      console.warn('[Cache] Erro ao limpar cache privado do usuário:', e);
    }
  }
};
