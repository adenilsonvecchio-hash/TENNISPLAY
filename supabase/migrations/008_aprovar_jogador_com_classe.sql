-- ==============================================================================
-- TennisPlay - Migração de Aprovação Obrigatória de Jogador com Definição de Classe
-- Arquivo: supabase/migrations/008_aprovar_jogador_com_classe.sql
-- ==============================================================================

BEGIN;

-- 1. Helper function para verificar se o usuário é proprietário ou administrador ativo do grupo
CREATE OR REPLACE FUNCTION public.e_proprietario_ou_admin_do_grupo(p_grupo_id UUID)
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
    WHERE grupo_id = p_grupo_id 
      AND usuario_id = auth.uid() 
      AND papel IN ('proprietario', 'administrador') 
      AND status = 'ativo'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.e_proprietario_ou_admin_do_grupo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_proprietario_ou_admin_do_grupo(UUID) TO authenticated;

-- 2. Trigger Function atualizada para permitir definição de classe na aprovação por Admin ou Proprietário
CREATE OR REPLACE FUNCTION public.validar_update_membros_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner BOOLEAN;
  v_is_admin_or_owner BOOLEAN;
  v_current_user_id UUID := auth.uid();
BEGIN
  v_is_owner := public.e_proprietario_do_grupo(OLD.grupo_id);
  v_is_admin_or_owner := public.e_proprietario_ou_admin_do_grupo(OLD.grupo_id);

  -- 1. Imutabilidade de usuario_id e grupo_id
  IF NEW.usuario_id IS DISTINCT FROM OLD.usuario_id OR NEW.grupo_id IS DISTINCT FROM OLD.grupo_id THEN
    RAISE EXCEPTION 'Não é permitido alterar usuario_id ou grupo_id do vínculo.';
  END IF;

  -- 2. REGRA DE CLASSE:
  -- Na aprovação de membro pendente (OLD.status = 'pendente' -> NEW.status = 'ativo'), Admin ou Proprietário podem definir a classe.
  -- Para membros já ativos, somente o PROPRIETÁRIO pode alterar a classe.
  IF OLD.classe IS DISTINCT FROM NEW.classe THEN
    IF OLD.status = 'pendente' AND NEW.status = 'ativo' THEN
      IF NOT v_is_admin_or_owner THEN
        RAISE EXCEPTION 'Permissão negada: somente administradores ou o proprietário do grupo podem aprovar jogadores com definição de classe.';
      END IF;
    ELSE
      IF NOT v_is_owner THEN
        RAISE EXCEPTION 'Permissão negada: somente o proprietário do grupo tem permissão para definir ou alterar a classe de jogadores.';
      END IF;
    END IF;
  END IF;

  -- 3. Impedir jogadores comuns de alterarem seu próprio papel, status ou classe
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

  -- 7. Registro de Notificação para alteração de classe (apenas se já era ativo)
  IF OLD.classe IS DISTINCT FROM NEW.classe AND OLD.status = 'ativo' THEN
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

-- 3. RPC Atômica de Aprovação de Jogador com Definição Obrigatória de Classe
CREATE OR REPLACE FUNCTION public.aprovar_jogador(
  p_membro_id UUID,
  p_classe TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_membro RECORD;
  v_is_authorized BOOLEAN;
  v_classe_normalizada TEXT;
  v_classe_display TEXT;
BEGIN
  -- 1. Validar autenticação do chamador
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.';
  END IF;

  -- 2. Localizar o membro pendente
  SELECT m.*, u.nome AS usuario_nome INTO v_membro
  FROM public.membros_grupo m
  JOIN public.usuarios u ON u.id = m.usuario_id
  WHERE m.id = p_membro_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Membro não encontrado.';
  END IF;

  -- 3. Validar status PENDENTE
  IF v_membro.status <> 'pendente' THEN
    RAISE EXCEPTION 'Este jogador já foi aprovado ou não está com status pendente.';
  END IF;

  -- 4. Validar se o chamador é PROPRIETARIO ou ADMINISTRADOR do mesmo grupo
  v_is_authorized := public.e_proprietario_ou_admin_do_grupo(v_membro.grupo_id);
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Permissão negada: apenas o proprietário ou administradores deste grupo podem aprovar jogadores.';
  END IF;

  -- 5. Validar que a classe não é vazia, "Sem Classe" ou inválida
  IF p_classe IS NULL OR TRIM(p_classe) = '' OR UPPER(TRIM(p_classe)) = 'SEM CLASSE' OR UPPER(TRIM(p_classe)) = 'NULL' THEN
    RAISE EXCEPTION 'É obrigatório selecionar uma classe válida para aprovar o jogador.';
  END IF;

  IF UPPER(TRIM(p_classe)) IN ('A', 'CLASSE A', 'CLASSE A (1º)') OR p_classe ILIKE '%A (1º)%' THEN
    v_classe_normalizada := 'A';
    v_classe_display := 'Classe A (1º)';
  ELSIF UPPER(TRIM(p_classe)) IN ('B', 'CLASSE B', 'CLASSE B (2º)') OR p_classe ILIKE '%B (2º)%' THEN
    v_classe_normalizada := 'B';
    v_classe_display := 'Classe B (2º)';
  ELSIF UPPER(TRIM(p_classe)) IN ('C', 'CLASSE C', 'CLASSE C (3º)') OR p_classe ILIKE '%C (3º)%' THEN
    v_classe_normalizada := 'C';
    v_classe_display := 'Classe C (3º)';
  ELSIF UPPER(TRIM(p_classe)) IN ('D', 'CLASSE D', 'CLASSE D (4º)') OR p_classe ILIKE '%D (4º)%' THEN
    v_classe_normalizada := 'D';
    v_classe_display := 'Classe D (4º)';
  ELSIF UPPER(TRIM(p_classe)) IN ('E', 'CLASSE E', 'CLASSE E (5º)') OR p_classe ILIKE '%E (5º)%' THEN
    v_classe_normalizada := 'E';
    v_classe_display := 'Classe E (5º)';
  ELSIF UPPER(TRIM(p_classe)) IN ('F', 'CLASSE F', 'CLASSE F (6º)') OR p_classe ILIKE '%F (6º)%' THEN
    v_classe_normalizada := 'F';
    v_classe_display := 'Classe F (6º)';
  ELSIF UPPER(TRIM(p_classe)) IN ('G', 'CLASSE G', 'CLASSE G (7º)') OR p_classe ILIKE '%G (7º)%' THEN
    v_classe_normalizada := 'G';
    v_classe_display := 'Classe G (7º)';
  ELSIF UPPER(TRIM(p_classe)) IN ('INFANTIL', 'CLASSE INFANTIL') OR p_classe ILIKE '%infantil%' THEN
    v_classe_normalizada := 'INFANTIL';
    v_classe_display := 'Classe Infantil';
  ELSIF UPPER(TRIM(p_classe)) IN ('JUVENIL', 'CLASSE JUVENIL') OR p_classe ILIKE '%juvenil%' THEN
    v_classe_normalizada := 'JUVENIL';
    v_classe_display := 'Classe Juvenil';
  ELSIF UPPER(TRIM(p_classe)) IN ('50+', 'CLASSE 50+', 'CLASSE (50+)') OR p_classe ILIKE '%50+%' THEN
    v_classe_normalizada := '50+';
    v_classe_display := 'Classe 50+';
  ELSE
    RAISE EXCEPTION 'Classe inválida informada: %', p_classe;
  END IF;

  -- 6. Atualização atômica de status e classe
  UPDATE public.membros_grupo
  SET 
    status = 'ativo',
    classe = v_classe_normalizada
  WHERE id = v_membro.id;

  -- 7. Registro de Notificação para o jogador aprovado
  INSERT INTO public.notificacoes (
    grupo_id,
    usuario_id,
    titulo,
    mensagem,
    tipo,
    lida,
    criado_em
  ) VALUES (
    v_membro.grupo_id,
    v_membro.usuario_id,
    'Solicitação Aprovada',
    'Sua solicitação de entrada no grupo foi aprovada na ' || v_classe_display || '!',
    'SOLICITACAO_APROVADA',
    FALSE,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'membro_id', v_membro.id,
    'usuario_id', v_membro.usuario_id,
    'grupo_id', v_membro.grupo_id,
    'jogador_nome', v_membro.usuario_nome,
    'status', 'ATIVO',
    'classe', v_classe_display,
    'classe_codigo', v_classe_normalizada,
    'mensagem', v_membro.usuario_nome || ' foi aprovado na ' || v_classe_display || '.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.aprovar_jogador(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aprovar_jogador(UUID, TEXT) TO authenticated;

COMMIT;
