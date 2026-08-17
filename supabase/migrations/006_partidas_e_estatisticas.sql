-- ==============================================================================
-- TennisPlay - Migração 006: Módulo de Partidas, Placar, Estatísticas, Feed e Fotos
-- Arquivo: supabase/migrations/006_partidas_e_estatisticas.sql
-- ==============================================================================

BEGIN;

-- 1. TABELA DE PARTIDAS
CREATE TABLE IF NOT EXISTS public.partidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  reserva_id UUID REFERENCES public.reservas(id) ON DELETE SET NULL,
  jogador_1_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  jogador_2_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'CONFIRMADA' CHECK (status IN (
    'AGUARDANDO_ADV',
    'CONFIRMADA',
    'REALIZADA',
    'AGUARDANDO_RESULTADO',
    'AGUARDANDO_CONFIRMACAO_RESULTADO',
    'FINALIZADA',
    'CANCELADA'
  )),
  resultado_informado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  vencedor_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  foto_path TEXT,
  foto_url TEXT,
  detalhes_placar TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  finalizado_em TIMESTAMPTZ
);

-- Índices de performance para partidas
CREATE INDEX IF NOT EXISTS idx_partidas_grupo_id ON public.partidas (grupo_id);
CREATE INDEX IF NOT EXISTS idx_partidas_jogador_1_id ON public.partidas (jogador_1_id);
CREATE INDEX IF NOT EXISTS idx_partidas_jogador_2_id ON public.partidas (jogador_2_id);
CREATE INDEX IF NOT EXISTS idx_partidas_status ON public.partidas (status);
CREATE INDEX IF NOT EXISTS idx_partidas_reserva_id ON public.partidas (reserva_id);

-- 2. TABELA DE SETS DA PARTIDA
CREATE TABLE IF NOT EXISTS public.partida_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id UUID NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  numero_set INTEGER NOT NULL CHECK (numero_set >= 1 AND numero_set <= 5),
  jogador_1_games INTEGER NOT NULL DEFAULT 0 CHECK (jogador_1_games >= 0),
  jogador_2_games INTEGER NOT NULL DEFAULT 0 CHECK (jogador_2_games >= 0),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT partida_sets_unico UNIQUE (partida_id, numero_set)
);

CREATE INDEX IF NOT EXISTS idx_partida_sets_partida_id ON public.partida_sets (partida_id);

-- 3. TABELA DE CURTIDAS NO FEED
CREATE TABLE IF NOT EXISTS public.partida_curtidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id UUID NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT partida_curtidas_unica UNIQUE (partida_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_partida_curtidas_partida ON public.partida_curtidas (partida_id);
CREATE INDEX IF NOT EXISTS idx_partida_curtidas_usuario ON public.partida_curtidas (usuario_id);

-- 4. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.partidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partida_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partida_curtidas ENABLE ROW LEVEL SECURITY;

-- 5. POLÍTICAS RLS PARA PARTIDAS
DROP POLICY IF EXISTS "Membros do grupo podem ver partidas" ON public.partidas;
CREATE POLICY "Membros do grupo podem ver partidas"
  ON public.partidas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.membros_grupo
      WHERE membros_grupo.grupo_id = partidas.grupo_id
        AND membros_grupo.usuario_id = auth.uid()
        AND membros_grupo.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "Participantes ou admin podem criar partidas" ON public.partidas;
CREATE POLICY "Participantes ou admin podem criar partidas"
  ON public.partidas FOR INSERT
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
  USING (
    (auth.uid() = jogador_1_id OR auth.uid() = jogador_2_id)
    OR EXISTS (
      SELECT 1 FROM public.membros_grupo
      WHERE membros_grupo.grupo_id = partidas.grupo_id
        AND membros_grupo.usuario_id = auth.uid()
        AND membros_grupo.papel IN ('proprietario', 'administrador')
        AND membros_grupo.status = 'ativo'
    )
  );

-- 6. POLÍTICAS RLS PARA SETS
DROP POLICY IF EXISTS "Membros podem ver sets" ON public.partida_sets;
CREATE POLICY "Membros podem ver sets"
  ON public.partida_sets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partidas p
      JOIN public.membros_grupo mg ON mg.grupo_id = p.grupo_id
      WHERE p.id = partida_sets.partida_id
        AND mg.usuario_id = auth.uid()
        AND mg.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "Participantes ou admin podem gerenciar sets" ON public.partida_sets;
CREATE POLICY "Participantes ou admin podem gerenciar sets"
  ON public.partida_sets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.partidas p
      LEFT JOIN public.membros_grupo mg ON mg.grupo_id = p.grupo_id AND mg.usuario_id = auth.uid()
      WHERE p.id = partida_sets.partida_id
        AND (
          p.jogador_1_id = auth.uid()
          OR p.jogador_2_id = auth.uid()
          OR (mg.papel IN ('proprietario', 'administrador') AND mg.status = 'ativo')
        )
    )
  );

-- 7. POLÍTICAS RLS PARA CURTIDAS
DROP POLICY IF EXISTS "Membros podem ver curtidas" ON public.partida_curtidas;
CREATE POLICY "Membros podem ver curtidas"
  ON public.partida_curtidas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.partidas p
      JOIN public.membros_grupo mg ON mg.grupo_id = p.grupo_id
      WHERE p.id = partida_curtidas.partida_id
        AND mg.usuario_id = auth.uid()
        AND mg.status = 'ativo'
    )
  );

DROP POLICY IF EXISTS "Usuarios podem curtir e descurtir" ON public.partida_curtidas;
CREATE POLICY "Usuarios podem curtir e descurtir"
  ON public.partida_curtidas FOR ALL
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

-- 8. STORAGE BUCKETS
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('match-photos', 'match-photos', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 9. RPC TRANSACIONAL: SALVAR RESULTADO DA PARTIDA
CREATE OR REPLACE FUNCTION public.salvar_resultado_partida(
  p_partida_id UUID,
  p_sets JSONB, -- Array de objetos: [{ "numero_set": 1, "jogador_1_games": 6, "jogador_2_games": 4 }, ...]
  p_foto_url TEXT DEFAULT NULL,
  p_foto_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_partida RECORD;
  v_item RECORD;
  v_set_row JSONB;
  v_sets_j1 INT := 0;
  v_sets_j2 INT := 0;
  v_vencedor_id UUID;
  v_detalhes_placar TEXT := '';
  v_is_admin BOOLEAN := FALSE;
  v_outro_jogador_id UUID;
  v_nome_autor TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
  END IF;

  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  -- Checar se é admin
  SELECT EXISTS (
    SELECT 1 FROM public.membros_grupo
    WHERE grupo_id = v_partida.grupo_id
      AND usuario_id = v_user_id
      AND papel IN ('proprietario', 'administrador')
      AND status = 'ativo'
  ) INTO v_is_admin;

  -- Validar permissão
  IF v_partida.jogador_1_id != v_user_id AND v_partida.jogador_2_id != v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Você não tem permissão para cadastrar o resultado desta partida.';
  END IF;

  IF v_partida.status = 'FINALIZADA' AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Esta partida já foi finalizada.';
  END IF;

  -- Remover sets antigos antes de recadastrar
  DELETE FROM public.partida_sets WHERE partida_id = p_partida_id;

  -- Iterar e inserir os sets calculando o vencedor
  FOR v_set_row IN SELECT * FROM jsonb_array_elements(p_sets)
  LOOP
    INSERT INTO public.partida_sets (
      partida_id,
      numero_set,
      jogador_1_games,
      jogador_2_games
    ) VALUES (
      p_partida_id,
      (v_set_row->>'numero_set')::INT,
      (v_set_row->>'jogador_1_games')::INT,
      (v_set_row->>'jogador_2_games')::INT
    );

    IF (v_set_row->>'jogador_1_games')::INT > (v_set_row->>'jogador_2_games')::INT THEN
      v_sets_j1 := v_sets_j1 + 1;
    ELSIF (v_set_row->>'jogador_2_games')::INT > (v_set_row->>'jogador_1_games')::INT THEN
      v_sets_j2 := v_sets_j2 + 1;
    END IF;

    IF v_detalhes_placar != '' THEN
      v_detalhes_placar := v_detalhes_placar || ' / ';
    END IF;
    v_detalhes_placar := v_detalhes_placar || (v_set_row->>'jogador_1_games') || 'x' || (v_set_row->>'jogador_2_games');
  END LOOP;

  -- Determinar vencedor matemático
  IF v_sets_j1 > v_sets_j2 THEN
    v_vencedor_id := v_partida.jogador_1_id;
  ELSIF v_sets_j2 > v_sets_j1 THEN
    v_vencedor_id := v_partida.jogador_2_id;
  ELSE
    RAISE EXCEPTION 'O placar dos sets está empatado. Deve haver um vencedor.';
  END IF;

  -- Atualizar a partida
  UPDATE public.partidas
  SET
    status = CASE 
      WHEN v_is_admin THEN 'FINALIZADA'
      ELSE 'AGUARDANDO_CONFIRMACAO_RESULTADO'
    END,
    resultado_informado_por = v_user_id,
    vencedor_id = v_vencedor_id,
    detalhes_placar = v_detalhes_placar,
    foto_url = COALESCE(p_foto_url, foto_url),
    foto_path = COALESCE(p_foto_path, foto_path),
    finalizado_em = CASE WHEN v_is_admin THEN NOW() ELSE NULL END
  WHERE id = p_partida_id;

  -- Criar notificação para o adversário caso não seja admin
  IF NOT v_is_admin THEN
    v_outro_jogador_id := CASE WHEN v_partida.jogador_1_id = v_user_id THEN v_partida.jogador_2_id ELSE v_partida.jogador_1_id END;
    SELECT nome INTO v_nome_autor FROM public.usuarios WHERE id = v_user_id;

    INSERT INTO public.notificacoes (
      grupo_id,
      usuario_id,
      titulo,
      mensagem,
      tipo
    ) VALUES (
      v_partida.grupo_id,
      v_outro_jogador_id,
      'Resultado de Partida Informado',
      COALESCE(v_nome_autor, 'Seu adversário') || ' informou o resultado da partida (' || v_detalhes_placar || '). Toque para conferir e confirmar.',
      'RESULTADO_INFORMADO'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'partida_id', p_partida_id,
    'status', CASE WHEN v_is_admin THEN 'FINALIZADA' ELSE 'AGUARDANDO_CONFIRMACAO_RESULTADO' END,
    'vencedor_id', v_vencedor_id,
    'placar', v_detalhes_placar
  );
END;
$$;

-- 10. RPC TRANSACIONAL: CONFIRMAR RESULTADO DA PARTIDA
CREATE OR REPLACE FUNCTION public.confirmar_resultado_partida(
  p_partida_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_partida RECORD;
  v_is_admin BOOLEAN := FALSE;
  v_outro_jogador_id UUID;
  v_nome_confirmador TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
  END IF;

  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  -- Checar se é admin
  SELECT EXISTS (
    SELECT 1 FROM public.membros_grupo
    WHERE grupo_id = v_partida.grupo_id
      AND usuario_id = v_user_id
      AND papel IN ('proprietario', 'administrador')
      AND status = 'ativo'
  ) INTO v_is_admin;

  -- O autor original do resultado não pode se auto-confirmar se for jogador comum
  IF NOT v_is_admin AND v_partida.resultado_informado_por = v_user_id THEN
    RAISE EXCEPTION 'A confirmação deve ser feita pelo seu adversário.';
  END IF;

  -- Validar se é o outro jogador ou admin
  IF v_partida.jogador_1_id != v_user_id AND v_partida.jogador_2_id != v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Você não tem permissão para confirmar o resultado desta partida.';
  END IF;

  -- Finalizar partida
  UPDATE public.partidas
  SET
    status = 'FINALIZADA',
    finalizado_em = NOW()
  WHERE id = p_partida_id;

  -- Notificar o autor do resultado
  v_outro_jogador_id := v_partida.resultado_informado_por;
  IF v_outro_jogador_id IS NOT NULL AND v_outro_jogador_id != v_user_id THEN
    SELECT nome INTO v_nome_confirmador FROM public.usuarios WHERE id = v_user_id;

    INSERT INTO public.notificacoes (
      grupo_id,
      usuario_id,
      titulo,
      mensagem,
      tipo
    ) VALUES (
      v_partida.grupo_id,
      v_outro_jogador_id,
      'Resultado Confirmado!',
      COALESCE(v_nome_confirmador, 'Seu adversário') || ' confirmou o resultado da partida. Suas estatísticas foram atualizadas.',
      'RESULTADO_CONFIRMADO'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'partida_id', p_partida_id,
    'status', 'FINALIZADA',
    'vencedor_id', v_partida.vencedor_id
  );
END;
$$;

-- 11. RPC: SOLICITAR CORREÇÃO DE PLACAR
CREATE OR REPLACE FUNCTION public.solicitar_correcao_partida(
  p_partida_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_partida RECORD;
  v_outro_jogador_id UUID;
  v_nome_solicitante TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
  END IF;

  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  IF v_partida.jogador_1_id != v_user_id AND v_partida.jogador_2_id != v_user_id THEN
    RAISE EXCEPTION 'Você não tem permissão nesta partida.';
  END IF;

  -- Voltar status para AGUARDANDO_RESULTADO
  UPDATE public.partidas
  SET
    status = 'AGUARDANDO_RESULTADO',
    resultado_informado_por = NULL
  WHERE id = p_partida_id;

  -- Notificar quem enviou o resultado contestado
  v_outro_jogador_id := v_partida.resultado_informado_por;
  IF v_outro_jogador_id IS NOT NULL AND v_outro_jogador_id != v_user_id THEN
    SELECT nome INTO v_nome_solicitante FROM public.usuarios WHERE id = v_user_id;

    INSERT INTO public.notificacoes (
      grupo_id,
      usuario_id,
      titulo,
      mensagem,
      tipo
    ) VALUES (
      v_partida.grupo_id,
      v_outro_jogador_id,
      'Correção de Placar Solicitada',
      COALESCE(v_nome_solicitante, 'Seu adversário') || ' contestou o resultado informado. Por favor, reenvie o placar correto.',
      'CORRECAO_SOLICITADA'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'partida_id', p_partida_id,
    'status', 'AGUARDANDO_RESULTADO'
  );
END;
$$;

COMMIT;
