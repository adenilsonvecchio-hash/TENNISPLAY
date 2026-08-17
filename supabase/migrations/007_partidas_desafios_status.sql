-- ==============================================================================
-- TennisPlay - Migração 007: Suporte completo a Desafios (AGUARDANDO_ACEITE, RECUSADA)
-- Arquivo: supabase/migrations/007_partidas_desafios_status.sql
-- ==============================================================================

BEGIN;

-- 1. Atualizar a constraint de status da tabela de partidas
ALTER TABLE public.partidas DROP CONSTRAINT IF EXISTS partidas_status_check;
ALTER TABLE public.partidas ADD CONSTRAINT partidas_status_check CHECK (status IN (
  'AGUARDANDO_ACEITE',
  'CONFIRMADA',
  'RECUSADA',
  'AGUARDANDO_ADV',
  'REALIZADA',
  'AGUARDANDO_RESULTADO',
  'AGUARDANDO_CONFIRMACAO_RESULTADO',
  'FINALIZADA',
  'CANCELADA'
));

-- 2. Atualizar políticas RLS de visualização de partidas para garantir acesso direto por jogador_1_id ou jogador_2_id
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

-- 3. Atualizar política RLS para atualização de partidas
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
