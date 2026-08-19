/**
 * Stale-While-Revalidate (SWR) Engine para o TennisPlay
 * 
 * Regras de TTL do LetsPlay:
 * - perfil e grupo: 10 minutos (600.000 ms)
 * - configurações de quadras: 10 minutos (600.000 ms)
 * - ranking: 2 minutos (120.000 ms)
 * - reservas e desafios: 30 segundos (30.000 ms)
 * - notificações: 30 segundos
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { LocalCache } from './cache';
import { perf } from './perf';

export const TTL_MAP = {
  PROFILE_GROUP: 10 * 60 * 1000, // 10 min
  COURT_CONFIG: 10 * 60 * 1000,  // 10 min
  RANKING: 2 * 60 * 1000,        // 2 min
  BOOKINGS_CHALLENGES: 30 * 1000,// 30 sec
  NOTIFICATIONS: 30 * 1000,      // 30 sec
  STATS: 5 * 60 * 1000,          // 5 min
  FEED: 1 * 60 * 1000            // 1 min
} as const;

// In-flight request deduplication map
const inflightPromises = new Map<string, Promise<any>>();
// Memory cache for active session
const memoryCache = new Map<string, { data: any; timestamp: number }>();

export interface SwrOptions<T> {
  type: string;
  userId?: string;
  groupId?: string;
  ttl?: number;
  fetcher: () => Promise<T>;
  initialData?: T;
  enabled?: boolean;
  onSuccess?: (data: T) => void;
}

export interface SwrResult<T> {
  data: T | undefined;
  isLoading: boolean;
  isRevalidating: boolean;
  error: Error | null;
  revalidate: () => Promise<T | undefined>;
  mutate: (newData: T | ((prev: T | undefined) => T), shouldRevalidate?: boolean) => Promise<void>;
}

export function useSwrData<T>(options: SwrOptions<T>): SwrResult<T> {
  const {
    type,
    userId,
    groupId,
    ttl = TTL_MAP.BOOKINGS_CHALLENGES,
    fetcher,
    initialData,
    enabled = true
  } = options;

  const cacheKey = LocalCache.getScopedKey(type, userId, groupId);

  // Read initial from memory or LocalCache synchronously
  const getInitialState = (): { data: T | undefined; isStale: boolean } => {
    if (initialData !== undefined) {
      return { data: initialData, isStale: false };
    }

    const inMem = memoryCache.get(cacheKey);
    if (inMem) {
      const isStale = Date.now() - inMem.timestamp > ttl;
      return { data: inMem.data as T, isStale };
    }

    const fromStorage = LocalCache.get<T>(type, userId, groupId);
    if (fromStorage) {
      memoryCache.set(cacheKey, fromStorage);
      const isStale = Date.now() - fromStorage.timestamp > ttl;
      return { data: fromStorage.data, isStale };
    }

    return { data: undefined, isStale: true };
  };

  const initial = getInitialState();
  const [data, setData] = useState<T | undefined>(initial.data);
  const [isLoading, setIsLoading] = useState<boolean>(!initial.data && enabled);
  const [isRevalidating, setIsRevalidating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const revalidate = useCallback(async (): Promise<T | undefined> => {
    if (!enabled) return undefined;

    const perfKey = `${type}_fetch`;
    perf.start(perfKey);

    setIsRevalidating(true);

    try {
      // In-flight deduplication
      let promise = inflightPromises.get(cacheKey);
      if (!promise) {
        promise = fetcherRef.current();
        inflightPromises.set(cacheKey, promise);
      }

      const freshData = await promise;

      // Update memory & local storage
      const now = Date.now();
      memoryCache.set(cacheKey, { data: freshData, timestamp: now });
      LocalCache.set(type, freshData, userId, groupId);

      setData(freshData);
      setError(null);
      options.onSuccess?.(freshData);
      
      perf.end(perfKey, { cached: false });
      return freshData;
    } catch (err: any) {
      console.warn(`[SWR Revalidate Error] ${type}:`, err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return undefined;
    } finally {
      inflightPromises.delete(cacheKey);
      setIsLoading(false);
      setIsRevalidating(false);
    }
  }, [cacheKey, enabled, type, userId, groupId]);

  useEffect(() => {
    if (!enabled) return;

    const current = getInitialState();
    if (current.data !== undefined) {
      setData(current.data);
      setIsLoading(false);
    }

    // If data is stale or absent, revalidate silently
    if (current.isStale || current.data === undefined) {
      revalidate();
    }
  }, [cacheKey, enabled]);

  const mutate = useCallback(
    async (newData: T | ((prev: T | undefined) => T), shouldRevalidate = false) => {
      const resolved =
        typeof newData === 'function'
          ? (newData as (prev: T | undefined) => T)(data)
          : newData;

      setData(resolved);
      const now = Date.now();
      memoryCache.set(cacheKey, { data: resolved, timestamp: now });
      LocalCache.set(type, resolved, userId, groupId);

      if (shouldRevalidate) {
        await revalidate();
      }
    },
    [cacheKey, data, type, userId, groupId, revalidate]
  );

  return {
    data,
    isLoading,
    isRevalidating,
    error,
    revalidate,
    mutate
  };
}

/**
 * Global Invalidation Helper
 * Invalida consultas específicas após mutações (ex: criar reserva, aceitar desafio)
 */
export function invalidateCache(type: string, userId?: string, groupId?: string): void {
  const key = LocalCache.getScopedKey(type, userId, groupId);
  memoryCache.delete(key);
  LocalCache.remove(type, userId, groupId);
}

/**
 * Limpa todo o cache em memória (usado no logout para garantir isolamento absoluto)
 */
export function clearAllMemoryCache(userId?: string): void {
  if (!userId) {
    memoryCache.clear();
    inflightPromises.clear();
  } else {
    for (const key of Array.from(memoryCache.keys())) {
      if (key.includes(`_${userId}_`)) {
        memoryCache.delete(key);
      }
    }
  }
}
