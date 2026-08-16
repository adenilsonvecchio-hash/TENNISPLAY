-- ==============================================================================
-- TennisPlay - Migração de Segurança: Restrição de Alteração de Classe
-- Arquivo: supabase/migrations/002_owner_only_player_class_security.sql
-- ==============================================================================

BEGIN;

-- 1. Helper function de verificação de proprietário do grupo
CREATE OR REPLACE FUNCTION public.e_proprietario_do_grupo(p_grupo_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
    WHERE grupo_id = p_grupo_id AND usuario_id = auth.uid() AND papel = 'proprietario' AND status = 'ativo'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.e_proprietario_do_grupo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_proprietario_do_grupo(UUID) TO authenticated;

-- 2. Trigger Function: Validação rigorosa de UPDATE em membros_grupo
CREATE OR REPLACE FUNCTION public.validar_update_membros_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_current_user_id UUID := auth.uid();
BEGIN
  -- Verificar se o usuário autenticado é o proprietário ativo do mesmo grupo
  v_is_owner := public.e_proprietario_do_grupo(OLD.grupo_id);

  -- 1. Imutabilidade de usuario_id e grupo_id
  IF NEW.usuario_id IS DISTINCT FROM OLD.usuario_id OR NEW.grupo_id IS DISTINCT FROM OLD.grupo_id THEN
    RAISE EXCEPTION 'Não é permitido alterar usuario_id ou grupo_id do vínculo.';
  END IF;

  -- 2. REGRA OBRIGATÓRIA: Somente o PROPRIETÁRIO do grupo pode alterar a classe de qualquer jogador
  IF OLD.classe IS DISTINCT FROM NEW.classe AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Permissão negada: somente o proprietário do grupo tem permissão para definir ou alterar a classe de jogadores.';
  END IF;

  -- 3. Impedir jogadores comuns ou administradores de alterarem seu próprio papel, status ou classe
  IF OLD.usuario_id = v_current_user_id AND NOT v_is_owner THEN
    IF OLD.papel IS DISTINCT FROM NEW.papel OR
       OLD.status IS DISTINCT FROM NEW.status OR
       OLD.classe IS DISTINCT FROM NEW.classe THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio papel, status ou classe.';
    END IF;
  END IF;

  -- 4. Impedir que administradores ou outros membros alterem qualquer dado do PROPRIETÁRIO
  IF OLD.papel = 'proprietario' AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Somente o proprietário do grupo pode alterar dados do proprietário.';
  END IF;

  -- 5. Impedir que não-proprietários atribuam o papel 'proprietario' a alguém
  IF NEW.papel = 'proprietario' AND OLD.papel IS DISTINCT FROM 'proprietario' AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Somente o proprietário do grupo pode atribuir o papel de proprietário.';
  END IF;

  -- 6. Garantir que alterar a classe do proprietário NUNCA altere seu papel de proprietario
  IF OLD.papel = 'proprietario' AND NEW.papel IS DISTINCT FROM 'proprietario' AND NOT (pg_trigger_depth() > 1) THEN
    RAISE EXCEPTION 'Alterar a classe não pode alterar o papel de proprietário do usuário.';
  END IF;

  -- 7. Registro de Notificação para alteração de classe
  IF OLD.classe IS DISTINCT FROM NEW.classe THEN
    INSERT INTO public.notificacoes (
      grupo_id,
      usuario_id,
      titulo,
      mensagem,
      tipo,
      lida,
      criado_em
    ) VALUES (
      NEW.grupo_id,
      NEW.usuario_id,
      'Alteração de Classe',
      'Sua classe foi definida como "' || COALESCE(NEW.classe, 'Sem Classe') || '" pelo proprietário do grupo.',
      'CLASSE_ALTERADA',
      FALSE,
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_update_membros_grupo ON public.membros_grupo;
CREATE TRIGGER trg_validar_update_membros_grupo
  BEFORE UPDATE ON public.membros_grupo
  FOR EACH ROW EXECUTE FUNCTION public.validar_update_membros_grupo();

-- 3. RPC Específica: alterar_classe_jogador
CREATE OR REPLACE FUNCTION public.alterar_classe_jogador(
  p_membro_id UUID,
  p_grupo_id UUID,
  p_nova_classe TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_membro RECORD;
  v_classe_normalizada TEXT;
  v_is_owner BOOLEAN;
BEGIN
  -- 1. Validar autenticação do chamador
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.';
  END IF;

  -- 2. Localizar o vínculo do jogador no grupo indicado (por membro.id ou membro.usuario_id)
  SELECT * INTO v_membro
  FROM public.membros_grupo
  WHERE (id = p_membro_id OR usuario_id = p_membro_id) AND grupo_id = p_grupo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jogador não encontrado no grupo especificado.';
  END IF;

  -- 3. Validar se o chamador autenticado é de fato o PROPRIETÁRIO do grupo no Supabase
  v_is_owner := public.e_proprietario_do_grupo(p_grupo_id);
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Apenas o proprietário do grupo pode alterar a classe dos jogadores.';
  END IF;

  -- 4. Normalizar e validar a nova classe
  IF p_nova_classe IS NULL OR TRIM(p_nova_classe) = '' OR UPPER(TRIM(p_nova_classe)) = 'SEM CLASSE' OR UPPER(TRIM(p_nova_classe)) = 'NULL' THEN
    v_classe_normalizada := NULL;
  ELSE
    IF UPPER(TRIM(p_nova_classe)) IN ('A', 'CLASSE A', 'CLASSE A (1º)') OR p_nova_classe ILIKE '%A (1º)%' THEN
      v_classe_normalizada := 'A';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('B', 'CLASSE B', 'CLASSE B (2º)') OR p_nova_classe ILIKE '%B (2º)%' THEN
      v_classe_normalizada := 'B';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('C', 'CLASSE C', 'CLASSE C (3º)') OR p_nova_classe ILIKE '%C (3º)%' THEN
      v_classe_normalizada := 'C';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('D', 'CLASSE D', 'CLASSE D (4º)') OR p_nova_classe ILIKE '%D (4º)%' THEN
      v_classe_normalizada := 'D';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('E', 'CLASSE E', 'CLASSE E (5º)') OR p_nova_classe ILIKE '%E (5º)%' THEN
      v_classe_normalizada := 'E';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('F', 'CLASSE F', 'CLASSE F (6º)') OR p_nova_classe ILIKE '%F (6º)%' THEN
      v_classe_normalizada := 'F';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('G', 'CLASSE G', 'CLASSE G (7º)') OR p_nova_classe ILIKE '%G (7º)%' THEN
      v_classe_normalizada := 'G';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('INFANTIL', 'CLASSE INFANTIL') OR p_nova_classe ILIKE '%infantil%' THEN
      v_classe_normalizada := 'INFANTIL';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('JUVENIL', 'CLASSE JUVENIL') OR p_nova_classe ILIKE '%juvenil%' THEN
      v_classe_normalizada := 'JUVENIL';
    ELSIF UPPER(TRIM(p_nova_classe)) IN ('50+', 'CLASSE 50+', 'CLASSE (50+)') OR p_nova_classe ILIKE '%50+%' THEN
      v_classe_normalizada := '50+';
    ELSE
      RAISE EXCEPTION 'Classe inválida informada: %', p_nova_classe;
    END IF;
  END IF;

  -- 5. Atualizar exclusivamente a coluna classe
  UPDATE public.membros_grupo
  SET classe = v_classe_normalizada
  WHERE id = v_membro.id;

  RETURN jsonb_build_object(
    'success', TRUE,
    'membro_id', v_membro.id,
    'usuario_id', v_membro.usuario_id,
    'grupo_id', v_membro.grupo_id,
    'classe', v_classe_normalizada,
    'mensagem', 'Classe atualizada com sucesso pelo proprietário.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.alterar_classe_jogador(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.alterar_classe_jogador(UUID, UUID, TEXT) TO authenticated;

COMMIT;
