-- ==============================================================================
-- TennisPlay - Migração Canônica: RPC cancelar_reserva Atômica e Segura
-- Arquivo: supabase/migrations/004_cancelar_reserva_rpc.sql
-- ==============================================================================

BEGIN;

-- 1. Criar ou substituir a RPC cancelar_reserva com SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.cancelar_reserva(
  p_reserva_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_reserva RECORD;
  v_is_admin BOOLEAN;
BEGIN
  -- 1. Validar sessão autenticada
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
  END IF;

  -- 2. Localizar reserva
  SELECT * INTO v_reserva
  FROM public.reservas
  WHERE id = p_reserva_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva não encontrada.';
  END IF;

  -- 3. Validar permissões (criador da reserva ou admin/proprietário do grupo)
  v_is_admin := public.e_admin_ou_proprietario_do_grupo(v_reserva.grupo_id);

  IF v_reserva.criador_id != v_user_id AND NOT v_is_admin THEN
    RAISE EXCEPTION 'Você não tem permissão para cancelar esta reserva.';
  END IF;

  -- 4. Se já estiver cancelada, retorna sucesso idempotente
  IF v_reserva.status = 'cancelada' THEN
    RETURN jsonb_build_object(
      'id', v_reserva.id,
      'status', 'cancelada',
      'cancelado_por', v_reserva.cancelado_por,
      'cancelado_em', v_reserva.cancelado_em,
      'message', 'Reserva já cancelada.'
    );
  END IF;

  -- 5. Atualizar reserva para status 'cancelada'
  UPDATE public.reservas
  SET 
    status = 'cancelada',
    cancelado_por = v_user_id,
    cancelado_em = NOW()
  WHERE id = p_reserva_id
  RETURNING * INTO v_reserva;

  RETURN jsonb_build_object(
    'id', v_reserva.id,
    'grupo_id', v_reserva.grupo_id,
    'status', v_reserva.status,
    'cancelado_por', v_reserva.cancelado_por,
    'cancelado_em', v_reserva.cancelado_em
  );
END;
$$;

-- 2. Permissões de Execução
REVOKE EXECUTE ON FUNCTION public.cancelar_reserva(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_reserva(UUID) TO authenticated;

COMMIT;
