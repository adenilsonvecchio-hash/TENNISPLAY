-- ==============================================================================
-- TennisPlay - Migração 009: Padronização e Correção de Status de Desafios e Partidas
-- Arquivo: supabase/migrations/009_corrigir_status_desafios_partidas.sql
-- ==============================================================================

BEGIN;

-- 1. Remover a constraint de status atual
ALTER TABLE public.partidas DROP CONSTRAINT IF EXISTS partidas_status_check;

-- 2. Recriar a constraint partidas_status_check incluindo PENDENTE, ACEITA, RECUSADA,
-- CANCELADA, CONCLUIDA e preservando todos os status válidos já existentes
ALTER TABLE public.partidas ADD CONSTRAINT partidas_status_check CHECK (
  status IN (
    'PENDENTE',
    'ACEITA',
    'RECUSADA',
    'CANCELADA',
    'CONCLUIDA',
    'AGUARDANDO_ACEITE',
    'CONFIRMADA',
    'FINALIZADA',
    'REALIZADA',
    'AGUARDANDO_ADV',
    'AGUARDANDO_RESULTADO',
    'AGUARDANDO_CONFIRMACAO_RESULTADO'
  )
);

-- 3. Atualizar o DEFAULT da coluna status na tabela partidas para PENDENTE
ALTER TABLE public.partidas ALTER COLUMN status SET DEFAULT 'PENDENTE';

-- 4. Garantir que as políticas RLS permitam a jogadores visualizar e atualizar partidas/desafios
DROP POLICY IF EXISTS "Jogadores visualizam suas partidas" ON public.partidas;
DROP POLICY IF EXISTS "Membros do grupo podem ver partidas" ON public.partidas;

CREATE POLICY "Jogadores visualizam suas partidas"
  ON public.partidas FOR SELECT
  TO authenticated
  USING (
    auth.uid() = jogador_1_id
    OR auth.uid() = jogador_2_id
    OR EXISTS (
      SELECT 1 FROM public.membros_grupo
      WHERE membros_grupo.grupo_id = partidas.grupo_id
        AND membros_grupo.usuario_id = auth.uid()
        AND membros_grupo.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "Participantes ou admin podem criar partidas" ON public.partidas;
CREATE POLICY "Participantes ou admin podem criar partidas"
  ON public.partidas FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = jogador_1_id
    AND EXISTS (
      SELECT 1 FROM public.membros_grupo
      WHERE membros_grupo.grupo_id = partidas.grupo_id
        AND membros_grupo.usuario_id = auth.uid()
        AND membros_grupo.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "Participantes ou admin podem atualizar partidas" ON public.partidas;
CREATE POLICY "Participantes ou admin podem atualizar partidas"
  ON public.partidas FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = jogador_1_id
    OR auth.uid() = jogador_2_id
    OR EXISTS (
      SELECT 1 FROM public.membros_grupo
      WHERE membros_grupo.grupo_id = partidas.grupo_id
        AND membros_grupo.usuario_id = auth.uid()
        AND membros_grupo.papel IN ('proprietario', 'administrador')
        AND membros_grupo.status = 'ativo'
    )
  );

COMMIT;
