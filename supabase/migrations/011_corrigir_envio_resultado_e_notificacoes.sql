-- ==============================================================================
-- TennisPlay - Migração 011: Correção RLS Notificações e RPCs Transacionais de Resultado
-- Arquivo: supabase/migrations/011_corrigir_envio_resultado_e_notificacoes.sql
-- ==============================================================================

BEGIN;

-- 1. GARANTIR FUNÇÃO DE AUTORIZAÇÃO DE PROPRIETÁRIO OU ADMINISTRADOR DO GRUPO
CREATE OR REPLACE FUNCTION public.e_proprietario_ou_admin_do_grupo(p_grupo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.grupos
    WHERE id = p_grupo_id AND proprietario_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.membros_grupo
    WHERE grupo_id = p_grupo_id 
      AND usuario_id = auth.uid() 
      AND UPPER(papel::text) IN ('PROPRIETARIO', 'ADMINISTRADOR') 
      AND UPPER(status::text) IN ('ATIVO', 'APROVADO')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.e_proprietario_ou_admin_do_grupo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_proprietario_ou_admin_do_grupo(UUID) TO authenticated;

-- 2. GARANTIR COLUNAS NECESSÁRIAS NA TABELA PARTIDAS
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS resultado_informado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS vencedor_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS detalhes_placar TEXT;
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS foto_path TEXT;
ALTER TABLE public.partidas ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ;

-- 3. COMPATIBILIZAR E ATUALIZAR STATUS DAS PARTIDAS
ALTER TABLE public.partidas DROP CONSTRAINT IF EXISTS partidas_status_check;
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

-- 4. ATUALIZAR CONSTRAINTS E COLUNAS DA TABELA NOTIFICACOES
ALTER TABLE public.notificacoes DROP CONSTRAINT IF EXISTS notificacoes_tipo_check;
ALTER TABLE public.notificacoes ADD CONSTRAINT notificacoes_tipo_check CHECK (
  tipo IN (
    'RESERVA_CONFIRMADA',
    'RESERVA_CANCELADA',
    'SOLICITACAO_APROVADA',
    'SOLICITACAO_RECUSADA',
    'CLASSE_ALTERADA',
    'PARTIDA_CRIADA',
    'DESAFIO_RECEBIDO',
    'DESAFIO_ACEITO',
    'DESAFIO_RECUSADO',
    'RESULTADO_INFORMADO',
    'RESULTADO_RECEBIDO',
    'RESULTADO_CONFIRMADO',
    'CORRECAO_SOLICITADA',
    'NOVA_PARTIDA',
    'MENSAGEM',
    'GERAL'
  )
);

ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS partida_id UUID REFERENCES public.partidas(id) ON DELETE CASCADE;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS remetente_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL;

-- 5. POLÍTICAS RLS PARA A TABELA NOTIFICACOES
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Ver proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Ver proprias notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Atualizar proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Atualizar proprias notificacoes" ON public.notificacoes
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Deletar proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Deletar proprias notificacoes" ON public.notificacoes
  FOR DELETE TO authenticated
  USING (usuario_id = auth.uid() OR public.e_proprietario_ou_admin_do_grupo(grupo_id));

DROP POLICY IF EXISTS "Admins podem inserir notificacoes" ON public.notificacoes;
CREATE POLICY "Admins podem inserir notificacoes" ON public.notificacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.e_proprietario_ou_admin_do_grupo(grupo_id));

-- 6. RPC TRANSACIONAL: enviar_resultado_partida
CREATE OR REPLACE FUNCTION public.enviar_resultado_partida(
  p_partida_id UUID,
  p_sets JSONB,
  p_foto_url TEXT DEFAULT NULL,
  p_foto_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_partida RECORD;
  v_set_row JSONB;
  v_sets_j1 INT := 0;
  v_sets_j2 INT := 0;
  v_vencedor_id UUID;
  v_detalhes_placar TEXT := '';
  v_is_admin BOOLEAN := FALSE;
  v_outro_jogador_id UUID;
  v_nome_autor TEXT;
  v_novo_status TEXT;
  v_sets_count INT := 0;
BEGIN
  -- A. Validar autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
  END IF;

  -- B. Carregar partida
  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  -- C. Checar se usuário é proprietário ou administrador ativo do grupo
  v_is_admin := public.e_proprietario_ou_admin_do_grupo(v_partida.grupo_id);

  -- D. Validar autorização do usuário (deve ser participante ou admin)
  IF v_partida.jogador_1_id != v_user_id AND v_partida.jogador_2_id != v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Você não tem permissão para registrar o resultado desta partida.';
  END IF;

  -- E. Validar estado atual da partida
  IF NOT v_is_admin THEN
    IF v_partida.status = 'PENDENTE' THEN
      RAISE EXCEPTION 'Não é possível informar o resultado de um desafio pendente de aceite.';
    ELSIF v_partida.status = 'RECUSADA' THEN
      RAISE EXCEPTION 'Esta partida foi recusada.';
    ELSIF v_partida.status = 'CANCELADA' THEN
      RAISE EXCEPTION 'Esta partida foi cancelada.';
    ELSIF v_partida.status IN ('CONCLUIDA', 'FINALIZADA') THEN
      RAISE EXCEPTION 'Esta partida já foi concluída.';
    ELSIF v_partida.status = 'AGUARDANDO_CONFIRMACAO_RESULTADO' THEN
      RAISE EXCEPTION 'Esta partida já possui um resultado aguardando confirmação.';
    ELSIF v_partida.status NOT IN ('ACEITA', 'CONFIRMADA', 'AGUARDANDO_RESULTADO', 'REALIZADA') THEN
      RAISE EXCEPTION 'Status da partida (%) não permite envio de resultado.', v_partida.status;
    END IF;
  END IF;

  -- F. Processar sets
  v_sets_count := jsonb_array_length(p_sets);
  IF v_sets_count IS NULL OR v_sets_count = 0 THEN
    RAISE EXCEPTION 'É necessário informar o placar de pelo menos um set.';
  END IF;

  IF v_sets_count > 5 THEN
    RAISE EXCEPTION 'Uma partida não pode ter mais de 5 sets.';
  END IF;

  -- Limpar sets anteriores
  DELETE FROM public.partida_sets WHERE partida_id = p_partida_id;

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
      GREATEST(0, (v_set_row->>'jogador_1_games')::INT),
      GREATEST(0, (v_set_row->>'jogador_2_games')::INT)
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

  -- G. Determinar vencedor matemático
  IF v_sets_j1 > v_sets_j2 THEN
    v_vencedor_id := v_partida.jogador_1_id;
  ELSIF v_sets_j2 > v_sets_j1 THEN
    v_vencedor_id := v_partida.jogador_2_id;
  ELSE
    RAISE EXCEPTION 'O placar dos sets está empatado. É necessário haver um vencedor.';
  END IF;

  v_novo_status := CASE 
    WHEN v_is_admin THEN 'CONCLUIDA'
    ELSE 'AGUARDANDO_CONFIRMACAO_RESULTADO'
  END;

  -- H. Atualizar a partida
  UPDATE public.partidas
  SET
    status = v_novo_status,
    resultado_informado_por = v_user_id,
    vencedor_id = v_vencedor_id,
    detalhes_placar = v_detalhes_placar,
    foto_url = COALESCE(p_foto_url, foto_url),
    foto_path = COALESCE(p_foto_path, foto_path),
    finalizado_em = CASE WHEN v_is_admin THEN NOW() ELSE NULL END
  WHERE id = p_partida_id;

  -- I. Notificar o adversário (quando não finalizado direto por admin)
  IF NOT v_is_admin THEN
    v_outro_jogador_id := CASE 
      WHEN v_partida.jogador_1_id = v_user_id THEN v_partida.jogador_2_id 
      ELSE v_partida.jogador_1_id 
    END;

    SELECT nome INTO v_nome_autor FROM public.usuarios WHERE id = v_user_id;

    -- Limpar notificações pendentes anteriores deste tipo para evitar duplicidades
    DELETE FROM public.notificacoes
    WHERE usuario_id = v_outro_jogador_id
      AND grupo_id = v_partida.grupo_id
      AND tipo IN ('RESULTADO_RECEBIDO', 'RESULTADO_INFORMADO')
      AND (partida_id = p_partida_id OR partida_id IS NULL);

    INSERT INTO public.notificacoes (
      grupo_id,
      usuario_id,
      partida_id,
      remetente_id,
      titulo,
      mensagem,
      tipo,
      lida
    ) VALUES (
      v_partida.grupo_id,
      v_outro_jogador_id,
      p_partida_id,
      v_user_id,
      'Resultado aguardando sua confirmação',
      COALESCE(v_nome_autor, 'Seu adversário') || ' informou o resultado da partida. Confira o placar e confirme.',
      'RESULTADO_RECEBIDO',
      FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'partida_id', p_partida_id,
    'status', v_novo_status,
    'vencedor_id', v_vencedor_id,
    'placar', v_detalhes_placar,
    'adversario_id', v_outro_jogador_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.enviar_resultado_partida(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enviar_resultado_partida(UUID, JSONB, TEXT, TEXT) TO authenticated;

-- 7. ALIAS RETROCOMPATÍVEL: salvar_resultado_partida
CREATE OR REPLACE FUNCTION public.salvar_resultado_partida(
  p_partida_id UUID,
  p_sets JSONB,
  p_foto_url TEXT DEFAULT NULL,
  p_foto_path TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.enviar_resultado_partida(p_partida_id, p_sets, p_foto_url, p_foto_path);
END;
$$;

REVOKE ALL ON FUNCTION public.salvar_resultado_partida(UUID, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.salvar_resultado_partida(UUID, JSONB, TEXT, TEXT) TO authenticated;

-- 8. RPC TRANSACIONAL: confirmar_resultado_partida
CREATE OR REPLACE FUNCTION public.confirmar_resultado_partida(
  p_partida_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_partida RECORD;
  v_is_admin BOOLEAN := FALSE;
  v_outro_jogador_id UUID;
  v_nome_confirmador TEXT;
BEGIN
  -- A. Validar autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
  END IF;

  -- B. Carregar partida
  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  -- C. Checar se usuário é proprietário ou administrador ativo do grupo
  v_is_admin := public.e_proprietario_ou_admin_do_grupo(v_partida.grupo_id);

  -- D. Validar status aguardando confirmação
  IF v_partida.status <> 'AGUARDANDO_CONFIRMACAO_RESULTADO' THEN
    RAISE EXCEPTION 'A partida não está aguardando confirmação de resultado (status atual: %).', v_partida.status;
  END IF;

  -- E. Validar que existe resultado_informado_por preenchido
  IF v_partida.resultado_informado_por IS NULL THEN
    RAISE EXCEPTION 'Nenhum resultado registrado para confirmar nesta partida.';
  END IF;

  -- F. Validar que o autor não pode confirmar seu próprio resultado (exceto admin oficializando)
  IF NOT v_is_admin AND v_partida.resultado_informado_por = v_user_id THEN
    RAISE EXCEPTION 'A confirmação do placar deve ser realizada pelo seu adversário.';
  END IF;

  -- G. Validar que o usuário é o adversário participante ou admin do grupo
  IF NOT v_is_admin AND v_partida.jogador_1_id != v_user_id AND v_partida.jogador_2_id != v_user_id THEN
    RAISE EXCEPTION 'Você não tem permissão para confirmar o resultado desta partida.';
  END IF;

  -- H. Finalizar a partida com status definitivo CONCLUIDA
  UPDATE public.partidas
  SET
    status = 'CONCLUIDA',
    finalizado_em = NOW()
  WHERE id = p_partida_id;

  -- I. Marcar como lidas as notificações de resultado pendente para o confirmador
  UPDATE public.notificacoes
  SET lida = TRUE
  WHERE usuario_id = v_user_id
    AND grupo_id = v_partida.grupo_id
    AND tipo IN ('RESULTADO_RECEBIDO', 'RESULTADO_INFORMADO')
    AND (partida_id = p_partida_id OR partida_id IS NULL);

  -- J. Notificar o autor que enviou o resultado inicial
  v_outro_jogador_id := v_partida.resultado_informado_por;
  IF v_outro_jogador_id IS NOT NULL AND v_outro_jogador_id != v_user_id THEN
    SELECT nome INTO v_nome_confirmador FROM public.usuarios WHERE id = v_user_id;

    INSERT INTO public.notificacoes (
      grupo_id,
      usuario_id,
      partida_id,
      remetente_id,
      titulo,
      mensagem,
      tipo,
      lida
    ) VALUES (
      v_partida.grupo_id,
      v_outro_jogador_id,
      p_partida_id,
      v_user_id,
      'Resultado Confirmado!',
      COALESCE(v_nome_confirmador, 'Seu adversário') || ' confirmou o resultado da partida. Suas estatísticas foram atualizadas.',
      'RESULTADO_CONFIRMADO',
      FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'partida_id', p_partida_id,
    'status', 'CONCLUIDA',
    'vencedor_id', v_partida.vencedor_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_resultado_partida(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_resultado_partida(UUID) TO authenticated;

-- 9. RPC TRANSACIONAL: solicitar_correcao_partida
CREATE OR REPLACE FUNCTION public.solicitar_correcao_partida(
  p_partida_id UUID,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_partida RECORD;
  v_is_admin BOOLEAN := FALSE;
  v_outro_jogador_id UUID;
  v_nome_solicitante TEXT;
BEGIN
  -- A. Validar autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
  END IF;

  -- B. Carregar partida
  SELECT * INTO v_partida FROM public.partidas WHERE id = p_partida_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partida não encontrada.';
  END IF;

  -- C. Checar se usuário é proprietário ou administrador ativo do grupo
  v_is_admin := public.e_proprietario_ou_admin_do_grupo(v_partida.grupo_id);

  -- D. Validar status aguardando confirmação
  IF v_partida.status <> 'AGUARDANDO_CONFIRMACAO_RESULTADO' THEN
    RAISE EXCEPTION 'A partida não possui resultado pendente de confirmação para contestar (status atual: %).', v_partida.status;
  END IF;

  -- E. Validar que existe resultado informado
  IF v_partida.resultado_informado_por IS NULL THEN
    RAISE EXCEPTION 'Nenhum resultado informado para contestar nesta partida.';
  END IF;

  -- F. Impedir que o próprio autor conteste seu próprio resultado
  IF v_user_id = v_partida.resultado_informado_por THEN
    RAISE EXCEPTION 'Você não pode contestar o resultado informado por você mesmo.';
  END IF;

  -- G. Validar que o solicitante é o adversário participante ou admin do grupo
  IF NOT v_is_admin AND v_partida.jogador_1_id != v_user_id AND v_partida.jogador_2_id != v_user_id THEN
    RAISE EXCEPTION 'Você não tem permissão para contestar o resultado desta partida.';
  END IF;

  -- H. Reverter status para AGUARDANDO_RESULTADO e limpar campos de placar pendente
  UPDATE public.partidas
  SET
    status = 'AGUARDANDO_RESULTADO',
    resultado_informado_por = NULL,
    vencedor_id = NULL,
    detalhes_placar = NULL
  WHERE id = p_partida_id;

  -- I. Limpar sets rejeitados
  DELETE FROM public.partida_sets WHERE partida_id = p_partida_id;

  -- J. Marcar notificações pendentes como lidas para o solicitante
  UPDATE public.notificacoes
  SET lida = TRUE
  WHERE usuario_id = v_user_id
    AND grupo_id = v_partida.grupo_id
    AND tipo IN ('RESULTADO_RECEBIDO', 'RESULTADO_INFORMADO')
    AND (partida_id = p_partida_id OR partida_id IS NULL);

  -- K. Notificar quem havia enviado o resultado contestado
  v_outro_jogador_id := v_partida.resultado_informado_por;
  IF v_outro_jogador_id IS NOT NULL AND v_outro_jogador_id != v_user_id THEN
    SELECT nome INTO v_nome_solicitante FROM public.usuarios WHERE id = v_user_id;

    INSERT INTO public.notificacoes (
      grupo_id,
      usuario_id,
      partida_id,
      remetente_id,
      titulo,
      mensagem,
      tipo,
      lida
    ) VALUES (
      v_partida.grupo_id,
      v_outro_jogador_id,
      p_partida_id,
      v_user_id,
      'Correção de Placar Solicitada',
      COALESCE(v_nome_solicitante, 'Seu adversário') || ' contestou o resultado informado. ' || COALESCE('Motivo: ' || NULLIF(TRIM(p_motivo), ''), 'Por favor, reenvie o placar correto.'),
      'CORRECAO_SOLICITADA',
      FALSE
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'partida_id', p_partida_id,
    'status', 'AGUARDANDO_RESULTADO'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_correcao_partida(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_correcao_partida(UUID, TEXT) TO authenticated;

COMMIT;
