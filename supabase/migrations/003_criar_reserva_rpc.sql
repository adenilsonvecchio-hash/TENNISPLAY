-- ==============================================================================
-- TennisPlay - Migração Canônica: RPC criar_reserva Atômica, Segura e Consistente
-- Arquivo: supabase/migrations/003_criar_reserva_rpc.sql
-- ==============================================================================

BEGIN;

-- 1. Remover versões sobrecarregadas anteriores para manter uma única RPC canônica
DROP FUNCTION IF EXISTS public.criar_reserva(UUID, DATE, INT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.criar_reserva(UUID, DATE, INT, TEXT, TEXT, TEXT, UUID);

-- 2. Criar RPC Canônica
CREATE OR REPLACE FUNCTION public.criar_reserva(
  p_grupo_id UUID,
  p_data DATE,
  p_quadra_numero INT,
  p_horario_id TEXT,
  p_horario_inicio TEXT DEFAULT NULL,
  p_horario_fim TEXT DEFAULT NULL,
  p_quadra_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_membro RECORD;
  v_quadra RECORD;
  v_horario RECORD;
  v_reserva RECORD;
  v_user RECORD;
  v_horario_uuid UUID;
  v_inicio TIME;
  v_fim TIME;
  v_data_hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_hora_agora TIME := (now() AT TIME ZONE 'America/Sao_Paulo')::time;
BEGIN
  -- 1. Validar autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
  END IF;

  -- 2. Regra de Negócio: Bloquear reservas em datas anteriores ao dia civil de hoje
  IF p_data < v_data_hoje THEN
    RAISE EXCEPTION 'Não é possível reservar horários em datas anteriores.';
  END IF;

  -- 2. Validar vínculo do usuário com o grupo
  SELECT * INTO v_membro
  FROM public.membros_grupo
  WHERE usuario_id = v_user_id AND grupo_id = p_grupo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seu cadastro ainda não está vinculado a este grupo.';
  END IF;

  IF v_membro.status = 'pendente' THEN
    RAISE EXCEPTION 'Seu acesso ao grupo ainda está aguardando aprovação.';
  END IF;

  IF v_membro.status != 'ativo' THEN
    RAISE EXCEPTION 'Seu cadastro não está ativo neste grupo.';
  END IF;

  -- 3. Obter e validar a quadra do grupo (por ID se fornecido e válido, ou por número no grupo)
  IF p_quadra_id IS NOT NULL THEN
    SELECT * INTO v_quadra
    FROM public.quadras
    WHERE id = p_quadra_id AND grupo_id = p_grupo_id;
  END IF;

  IF v_quadra IS NULL THEN
    SELECT * INTO v_quadra
    FROM public.quadras
    WHERE grupo_id = p_grupo_id AND numero = p_quadra_numero;
  END IF;

  IF v_quadra IS NULL THEN
    -- Se as quadras ainda não foram criadas para o grupo, auto-provisiona as 4 quadras padrão
    IF NOT EXISTS (SELECT 1 FROM public.quadras WHERE grupo_id = p_grupo_id) THEN
      INSERT INTO public.quadras (grupo_id, numero, nome, ativa)
      VALUES 
        (p_grupo_id, 1, 'Quadra 1', TRUE),
        (p_grupo_id, 2, 'Quadra 2', TRUE),
        (p_grupo_id, 3, 'Quadra 3', TRUE),
        (p_grupo_id, 4, 'Quadra 4', TRUE)
      ON CONFLICT (grupo_id, numero) DO NOTHING;

      SELECT * INTO v_quadra
      FROM public.quadras
      WHERE grupo_id = p_grupo_id AND numero = p_quadra_numero;
    END IF;
  END IF;

  IF v_quadra IS NULL THEN
    RAISE EXCEPTION 'A Quadra % não foi encontrada neste clube.', p_quadra_numero;
  END IF;

  IF v_quadra.ativa = FALSE THEN
    RAISE EXCEPTION 'A Quadra % está inativa ou indisponível.', v_quadra.numero;
  END IF;

  -- 4. Obter e validar o horário do grupo
  IF p_horario_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_horario_uuid := p_horario_id::UUID;
    SELECT * INTO v_horario
    FROM public.horarios
    WHERE id = v_horario_uuid AND grupo_id = p_grupo_id AND ativo = TRUE;
  END IF;

  IF v_horario IS NULL AND p_horario_inicio IS NOT NULL AND p_horario_fim IS NOT NULL THEN
    BEGIN
      v_inicio := p_horario_inicio::TIME;
      v_fim := p_horario_fim::TIME;
      SELECT * INTO v_horario
      FROM public.horarios
      WHERE grupo_id = p_grupo_id AND hora_inicio = v_inicio AND hora_fim = v_fim AND ativo = TRUE;
    EXCEPTION WHEN OTHERS THEN
      v_horario := NULL;
    END;
  END IF;

  IF v_horario IS NULL THEN
    -- Se o grupo não possui horários criados ainda, auto-provisiona a grade padrão
    IF NOT EXISTS (SELECT 1 FROM public.horarios WHERE grupo_id = p_grupo_id) THEN
      INSERT INTO public.horarios (grupo_id, hora_inicio, hora_fim, turno, ativo)
      VALUES
        (p_grupo_id, '07:00'::TIME, '08:30'::TIME, 'manha', TRUE),
        (p_grupo_id, '08:30'::TIME, '10:00'::TIME, 'manha', TRUE),
        (p_grupo_id, '10:00'::TIME, '11:30'::TIME, 'manha', TRUE),
        (p_grupo_id, '13:00'::TIME, '14:30'::TIME, 'tarde', TRUE),
        (p_grupo_id, '14:30'::TIME, '16:00'::TIME, 'tarde', TRUE),
        (p_grupo_id, '16:00'::TIME, '17:30'::TIME, 'tarde', TRUE),
        (p_grupo_id, '17:30'::TIME, '19:00'::TIME, 'noite', TRUE),
        (p_grupo_id, '19:00'::TIME, '20:30'::TIME, 'noite', TRUE),
        (p_grupo_id, '20:30'::TIME, '22:00'::TIME, 'noite', TRUE)
      ON CONFLICT DO NOTHING;

      IF p_horario_inicio IS NOT NULL AND p_horario_fim IS NOT NULL THEN
        SELECT * INTO v_horario
        FROM public.horarios
        WHERE grupo_id = p_grupo_id AND hora_inicio = v_inicio AND hora_fim = v_fim AND ativo = TRUE;
      END IF;
    END IF;

    IF v_horario IS NULL THEN
      RAISE EXCEPTION 'Este horário não está mais disponível ou foi desativado.';
    END IF;
  END IF;

  -- 6. Regra de Negócio: Bloquear horários que já iniciaram no dia atual
  IF p_data = v_data_hoje AND v_horario.hora_inicio <= v_hora_agora THEN
    RAISE EXCEPTION 'Este horário já começou e não pode mais ser reservado.';
  END IF;

  -- 5. Verificar conflito de reserva existente (concorrência e duplicidade)
  IF EXISTS (
    SELECT 1 FROM public.reservas
    WHERE grupo_id = p_grupo_id
      AND quadra_id = v_quadra.id
      AND horario_id = v_horario.id
      AND data = p_data
      AND status IN ('aguardando', 'confirmada')
  ) THEN
    RAISE EXCEPTION 'Este horário acabou de ser reservado por outro jogador. Escolha outro horário.';
  END IF;

  -- 6. Inserir a reserva atomicamente vinculando a classe real do membro no grupo
  BEGIN
    INSERT INTO public.reservas (
      grupo_id,
      quadra_id,
      horario_id,
      data,
      criador_id,
      criador_classe,
      nome_convidado,
      status
    ) VALUES (
      p_grupo_id,
      v_quadra.id,
      v_horario.id,
      p_data,
      v_user_id,
      v_membro.classe,
      'Adversário a definir',
      'confirmada'
    ) RETURNING * INTO v_reserva;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'Este horário acabou de ser reservado por outro jogador. Escolha outro horário.';
  END;

  -- 7. Carregar dados do usuário criador para resposta
  SELECT nome INTO v_user FROM public.usuarios WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'id', v_reserva.id,
    'grupo_id', v_reserva.grupo_id,
    'data', v_reserva.data,
    'horario_id', v_reserva.horario_id,
    'horario_label', TO_CHAR(v_horario.hora_inicio, 'HH24:MI') || ' às ' || TO_CHAR(v_horario.hora_fim, 'HH24:MI'),
    'quadra_id', v_quadra.id,
    'quadra_numero', v_quadra.numero,
    'jogador_id', v_reserva.criador_id,
    'jogador_nome', COALESCE(v_user.nome, 'Jogador'),
    'jogador_classe', v_reserva.criador_classe,
    'created_at', v_reserva.criado_em
  );
END;
$$;

-- Permissões de Execução da RPC
REVOKE EXECUTE ON FUNCTION public.criar_reserva(UUID, DATE, INT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_reserva(UUID, DATE, INT, TEXT, TEXT, TEXT, UUID) TO authenticated;

COMMIT;
