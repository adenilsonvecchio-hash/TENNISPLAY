BEGIN;

-- ==============================================================================
-- TennisPlay - Schema de Banco de Dados Supabase (Migração Completa e Segura)
-- Arquivo: supabase/migrations/001_tennisplay_schema.sql
-- ==============================================================================

-- Habilita extensão pgcrypto para geração de UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. TABELA DE USUÁRIOS (Perfil vinculado ao Supabase Auth)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT,
  whatsapp TEXT,
  avatar_url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 2. TABELA DE GRUPOS DE TÊNIS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  codigo TEXT UNIQUE NOT NULL,
  descricao TEXT,
  logo_url TEXT,
  proprietario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  permite_convidado BOOLEAN DEFAULT TRUE NOT NULL,
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  default_qtd_quadras INTEGER DEFAULT 4 NOT NULL,
  prazo_cancelamento_horas INTEGER DEFAULT 2 NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 3. TABELA DE MEMBROS DO GRUPO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.membros_grupo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('proprietario', 'administrador', 'jogador')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'ativo', 'bloqueado')),
  classe TEXT CHECK (classe IS NULL OR classe IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'INFANTIL', 'JUVENIL', '50+')),
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT membros_grupo_unico UNIQUE (grupo_id, usuario_id)
);

-- ==============================================================================
-- 4. TABELA DE QUADRAS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.quadras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  numero INTEGER NOT NULL,
  nome TEXT NOT NULL,
  ativa BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT quadras_numero_unico_por_grupo UNIQUE (grupo_id, numero)
);

-- ==============================================================================
-- 5. TABELA DE HORÁRIOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.horarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  turno TEXT CHECK (turno IN ('manha', 'tarde', 'noite')),
  ativo BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 6. TABELA DE RESERVAS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
  horario_id UUID NOT NULL REFERENCES public.horarios(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  criador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  criador_classe TEXT CHECK (criador_classe IS NULL OR criador_classe IN ('A', 'B', 'C', 'D', 'E', 'F', 'G', 'INFANTIL', 'JUVENIL', '50+')),
  adversario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  nome_convidado TEXT DEFAULT 'Adversário a definir',
  telefone_convidado TEXT,
  status TEXT NOT NULL DEFAULT 'confirmada' CHECK (status IN ('aguardando', 'confirmada', 'recusada', 'cancelada')),
  respondido_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  cancelado_por UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  motivo_cancelamento TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Restrição contra reserva duplicada no mesmo grupo, data, horário e quadra em reservas ativas
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservas_unicas_horario
  ON public.reservas (grupo_id, data, horario_id, quadra_id)
  WHERE status IN ('aguardando', 'confirmada');

-- ==============================================================================
-- 7. TABELA DE NOTIFICAÇÕES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('RESERVA_CONFIRMADA', 'RESERVA_CANCELADA', 'SOLICITACAO_APROVADA', 'SOLICITACAO_RECUSADA', 'CLASSE_ALTERADA')),
  lida BOOLEAN DEFAULT FALSE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 8. TABELA DE CONVITES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.convites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
  codigo TEXT NOT NULL,
  criador_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  usado BOOLEAN DEFAULT FALSE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 9. TABELA DE CONFIGURAÇÕES DO GRUPO
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.configuracoes_grupo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID NOT NULL UNIQUE REFERENCES public.grupos(id) ON DELETE CASCADE,
  default_qtd_quadras INTEGER DEFAULT 4 NOT NULL,
  prazo_cancelamento_horas INTEGER DEFAULT 2 NOT NULL,
  permite_convidado BOOLEAN DEFAULT TRUE NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- 10. TABELA DE AUDIT LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,
  detalhes JSONB,
  criado_em TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ==============================================================================
-- ÍNDICES DE DESEMPENHO E CONSULTA
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_grupos_codigo ON public.grupos(codigo);
CREATE INDEX IF NOT EXISTS idx_grupos_proprietario ON public.grupos(proprietario_id);
CREATE INDEX IF NOT EXISTS idx_membros_grupo_usuario ON public.membros_grupo(usuario_id);
CREATE INDEX IF NOT EXISTS idx_membros_grupo_grupo ON public.membros_grupo(grupo_id);
CREATE INDEX IF NOT EXISTS idx_quadras_grupo ON public.quadras(grupo_id);
CREATE INDEX IF NOT EXISTS idx_horarios_grupo ON public.horarios(grupo_id);
CREATE INDEX IF NOT EXISTS idx_reservas_grupo_data ON public.reservas(grupo_id, data);
CREATE INDEX IF NOT EXISTS idx_reservas_criador ON public.reservas(criador_id);
CREATE INDEX IF NOT EXISTS idx_reservas_adversario ON public.reservas(adversario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON public.notificacoes(usuario_id);

-- ==============================================================================
-- FUNÇÕES SECURITY DEFINER (SET search_path = public)
-- ==============================================================================

-- Helper: Verifica se o usuário autenticado é membro ativo do grupo
CREATE OR REPLACE FUNCTION public.e_membro_do_grupo(p_grupo_id UUID)
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
    SELECT 1 FROM public.membros_grupo
    WHERE grupo_id = p_grupo_id
      AND usuario_id = auth.uid()
      AND status = 'ativo'
  );
END;
$$;

-- Helper: Verifica se o usuário autenticado é admin ou proprietário do grupo
CREATE OR REPLACE FUNCTION public.e_admin_ou_proprietario_do_grupo(p_grupo_id UUID)
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
    SELECT 1 FROM public.membros_grupo
    WHERE grupo_id = p_grupo_id
      AND usuario_id = auth.uid()
      AND status = 'ativo'
      AND papel IN ('proprietario', 'administrador')
  ) OR EXISTS (
    SELECT 1 FROM public.grupos
    WHERE id = p_grupo_id AND proprietario_id = auth.uid()
  );
END;
$$;

-- Helper: Verifica se o usuário autenticado é o proprietário do grupo
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

-- Revoga execução pública e concede acesso seguro às funções auxiliares
REVOKE EXECUTE ON FUNCTION public.e_membro_do_grupo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_membro_do_grupo(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.e_admin_ou_proprietario_do_grupo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_admin_ou_proprietario_do_grupo(UUID) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.e_proprietario_do_grupo(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.e_proprietario_do_grupo(UUID) TO authenticated;

-- Trigger Function: Criação do perfil em public.usuarios após registro no Supabase Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome, email, whatsapp, avatar_url, criado_em)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    email = EXCLUDED.email,
    whatsapp = COALESCE(EXCLUDED.whatsapp, public.usuarios.whatsapp);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger Function: Vincula o proprietário automaticamente como membro ativo no grupo
CREATE OR REPLACE FUNCTION public.handle_new_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.membros_grupo (grupo_id, usuario_id, papel, status, classe)
  VALUES (NEW.id, NEW.proprietario_id, 'proprietario', 'ativo', NULL)
  ON CONFLICT (grupo_id, usuario_id) DO UPDATE
    SET papel = 'proprietario', status = 'ativo';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_grupo_created ON public.grupos;
CREATE TRIGGER on_grupo_created
  AFTER INSERT ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_grupo();

-- Trigger Function: Validação de consistência do grupo na reserva
CREATE OR REPLACE FUNCTION public.validar_reserva_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.quadras 
    WHERE id = NEW.quadra_id AND grupo_id = NEW.grupo_id AND ativa = TRUE
  ) THEN
    RAISE EXCEPTION 'A quadra selecionada não pertence a este grupo ou está inativa.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.horarios 
    WHERE id = NEW.horario_id AND grupo_id = NEW.grupo_id AND ativo = TRUE
  ) THEN
    RAISE EXCEPTION 'O horário selecionado não pertence a este grupo ou está inativo.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_reserva_grupo ON public.reservas;
CREATE TRIGGER trg_validar_reserva_grupo
  BEFORE INSERT OR UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.validar_reserva_grupo();

-- Trigger Function: Validação e execução em lote da transferência de propriedade do grupo (BEFORE UPDATE)
CREATE OR REPLACE FUNCTION public.validar_update_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.proprietario_id IS DISTINCT FROM NEW.proprietario_id THEN
    -- Apenas o proprietário atual pode transferir a propriedade do grupo
    IF OLD.proprietario_id != auth.uid() THEN
      RAISE EXCEPTION 'Apenas o proprietário atual do grupo pode transferir a propriedade.';
    END IF;

    -- Valida se o novo proprietário é um membro ativo do grupo
    IF NOT EXISTS (
      SELECT 1 FROM public.membros_grupo
      WHERE grupo_id = NEW.id
        AND usuario_id = NEW.proprietario_id
        AND status = 'ativo'
    ) THEN
      RAISE EXCEPTION 'O novo proprietário deve ser um membro ativo do grupo.';
    END IF;

    -- Rebaixa o proprietário anterior para administrador no grupo
    UPDATE public.membros_grupo
    SET papel = 'administrador'
    WHERE grupo_id = NEW.id AND usuario_id = OLD.proprietario_id;

    -- Promove o novo proprietário para papel='proprietario' e status='ativo'
    INSERT INTO public.membros_grupo (grupo_id, usuario_id, papel, status)
    VALUES (NEW.id, NEW.proprietario_id, 'proprietario', 'ativo')
    ON CONFLICT (grupo_id, usuario_id) DO UPDATE
      SET papel = 'proprietario', status = 'ativo';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_update_grupo ON public.grupos;
CREATE TRIGGER trg_validar_update_grupo
  BEFORE UPDATE ON public.grupos
  FOR EACH ROW EXECUTE FUNCTION public.validar_update_grupo();

-- Trigger Function: Validação de atualização de membros (papéis e permissões)
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

  -- 2. Impedir jogadores comuns ou administradores de alterarem seu próprio papel, status ou classe
  IF OLD.usuario_id = v_current_user_id AND NOT v_is_owner THEN
    IF OLD.papel IS DISTINCT FROM NEW.papel OR
       OLD.status IS DISTINCT FROM NEW.status OR
       OLD.classe IS DISTINCT FROM NEW.classe THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio papel, status ou classe.';
    END IF;
  END IF;

  -- 3. Impedir que administradores ou outros membros alterem qualquer dado do PROPRIETÁRIO
  IF OLD.papel = 'proprietario' AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Somente o proprietário do grupo pode alterar seu próprio registro ou papel de proprietário.';
  END IF;

  -- 4. Impedir que não-proprietários atribuam o papel 'proprietario' a alguém
  IF NEW.papel = 'proprietario' AND OLD.papel IS DISTINCT FROM 'proprietario' AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Somente o proprietário do grupo pode atribuir o papel de proprietário.';
  END IF;

  -- 5. Garantir que alterar a classe do proprietário NUNCA altere seu papel de proprietario
  IF OLD.papel = 'proprietario' AND NEW.papel IS DISTINCT FROM 'proprietario' AND NOT (pg_trigger_depth() > 1) THEN
    RAISE EXCEPTION 'Alterar a classe não pode alterar o papel de proprietário do usuário.';
  END IF;

  -- 6. Registro de Auditoria para alteração de classe
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
      'Classe alterada de "' || COALESCE(OLD.classe, 'Sem Classe') || '" para "' || COALESCE(NEW.classe, 'Sem Classe') || '" por ' || COALESCE(v_current_user_id::text, 'Sistema') || ' em ' || TO_CHAR(NOW(), 'DD/MM/YYYY HH24:MI'),
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

-- Trigger Function: Proteção na exclusão de membros do grupo
CREATE OR REPLACE FUNCTION public.validar_delete_membros_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Impedir exclusão de membro que possui papel='proprietario'
  IF OLD.papel = 'proprietario' THEN
    RAISE EXCEPTION 'Não é possível excluir o proprietário do grupo. É necessário realizar a transferência formal da propriedade antes.';
  END IF;

  -- Impedir exclusão se o usuário for o proprietário atual cadastrado na tabela de grupos
  IF EXISTS (
    SELECT 1 FROM public.grupos
    WHERE id = OLD.grupo_id AND proprietario_id = OLD.usuario_id
  ) THEN
    RAISE EXCEPTION 'Não é possível excluir o proprietário do grupo. É necessário realizar a transferência formal da propriedade antes.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_delete_membros_grupo ON public.membros_grupo;
CREATE TRIGGER trg_validar_delete_membros_grupo
  BEFORE DELETE ON public.membros_grupo
  FOR EACH ROW EXECUTE FUNCTION public.validar_delete_membros_grupo();

-- Trigger Function: Imutabilidade, Transição Estrita e Campos Automáticos em Reservas
CREATE OR REPLACE FUNCTION public.validar_transicao_reserva()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_is_criador BOOLEAN;
  v_is_adversario BOOLEAN;
BEGIN
  v_is_admin := public.e_admin_ou_proprietario_do_grupo(OLD.grupo_id);
  v_is_criador := (OLD.criador_id = v_user_id);
  v_is_adversario := (OLD.adversario_id IS NOT NULL AND OLD.adversario_id = v_user_id);

  -- 1. Imutabilidade de campos chaves para não administradores
  IF NOT v_is_admin THEN
    IF OLD.grupo_id IS DISTINCT FROM NEW.grupo_id OR
       OLD.quadra_id IS DISTINCT FROM NEW.quadra_id OR
       OLD.horario_id IS DISTINCT FROM NEW.horario_id OR
       OLD.data IS DISTINCT FROM NEW.data OR
       OLD.criador_id IS DISTINCT FROM NEW.criador_id THEN
      RAISE EXCEPTION 'Não é permitido alterar grupo, criador, quadra, horário ou data de uma reserva existente.';
    END IF;

    IF OLD.adversario_id IS DISTINCT FROM NEW.adversario_id THEN
      RAISE EXCEPTION 'O adversário não pode ser alterado após a criação da reserva.';
    END IF;
  END IF;

  -- 2. Matriz Estrita de Transições e Manipulação de Campos Automáticos (sem confiar no frontend)
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF OLD.status = 'aguardando' AND NEW.status = 'confirmada' THEN
      IF NOT (v_is_adversario OR v_is_admin) THEN
        RAISE EXCEPTION 'Apenas o adversário ou administrador pode confirmar uma reserva aguardando.';
      END IF;
      NEW.respondido_em := NOW();
      NEW.cancelado_em := OLD.cancelado_em;
      NEW.cancelado_por := OLD.cancelado_por;

    ELSIF OLD.status = 'aguardando' AND NEW.status = 'recusada' THEN
      IF NOT (v_is_adversario OR v_is_admin) THEN
        RAISE EXCEPTION 'Apenas o adversário ou administrador pode recusar uma reserva aguardando.';
      END IF;
      NEW.respondido_em := NOW();
      NEW.cancelado_em := OLD.cancelado_em;
      NEW.cancelado_por := OLD.cancelado_por;

    ELSIF (OLD.status = 'aguardando' OR OLD.status = 'confirmada') AND NEW.status = 'cancelada' THEN
      IF NOT (v_is_criador OR v_is_admin) THEN
        RAISE EXCEPTION 'Apenas o criador ou administrador pode cancelar a reserva.';
      END IF;
      NEW.cancelado_em := NOW();
      NEW.cancelado_por := v_user_id;
      NEW.respondido_em := OLD.respondido_em;

    ELSE
      RAISE EXCEPTION 'Transição de status de reserva inválida (de % para %).', OLD.status, NEW.status;
    END IF;
  ELSE
    -- Se o status não mudou, forçar a preservação dos campos automáticos anteriores ignorando valores de NEW
    NEW.respondido_em := OLD.respondido_em;
    NEW.cancelado_em := OLD.cancelado_em;
    NEW.cancelado_por := OLD.cancelado_por;
  END IF;

  -- 3. Restrições adicionais para adversário não admin
  IF v_is_adversario AND NOT v_is_admin AND NOT v_is_criador THEN
    IF OLD.criador_classe IS DISTINCT FROM NEW.criador_classe OR
       OLD.nome_convidado IS DISTINCT FROM NEW.nome_convidado OR
       OLD.telefone_convidado IS DISTINCT FROM NEW.telefone_convidado THEN
      RAISE EXCEPTION 'O adversário só pode responder aceitando ou recusando a reserva.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_transicao_reserva ON public.reservas;
CREATE TRIGGER trg_validar_transicao_reserva
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.validar_transicao_reserva();

-- Trigger Function: Validação de atualização de notificações (apenas o campo 'lida' pode mudar)
CREATE OR REPLACE FUNCTION public.validar_update_notificacoes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.grupo_id IS DISTINCT FROM NEW.grupo_id OR
     OLD.usuario_id IS DISTINCT FROM NEW.usuario_id OR
     OLD.titulo IS DISTINCT FROM NEW.titulo OR
     OLD.mensagem IS DISTINCT FROM NEW.mensagem OR
     OLD.tipo IS DISTINCT FROM NEW.tipo OR
     OLD.criado_em IS DISTINCT FROM NEW.criado_em THEN
    RAISE EXCEPTION 'Apenas o campo lida pode ser alterado em notificações.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_update_notificacoes ON public.notificacoes;
CREATE TRIGGER trg_validar_update_notificacoes
  BEFORE UPDATE ON public.notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.validar_update_notificacoes();

-- Função RPC: Criar grupo transacionalmente vinculando proprietário
CREATE OR REPLACE FUNCTION public.criar_grupo_com_proprietario(
  p_nome TEXT,
  p_descricao TEXT DEFAULT NULL,
  p_codigo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_grupo_id UUID;
  v_codigo TEXT;
  v_grupo RECORD;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Sessão não autenticada.';
  END IF;

  IF p_codigo IS NULL OR TRIM(p_codigo) = '' THEN
    v_codigo := UPPER(SUBSTRING(REGEXP_REPLACE(p_nome, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 5)) || FLOOR(1000 + RANDOM() * 9000)::TEXT;
  ELSE
    v_codigo := UPPER(TRIM(p_codigo));
  END IF;

  INSERT INTO public.grupos (nome, codigo, descricao, proprietario_id, permite_convidado, ativo)
  VALUES (TRIM(p_nome), v_codigo, p_descricao, v_usuario_id, TRUE, TRUE)
  RETURNING id INTO v_grupo_id;

  SELECT * INTO v_grupo FROM public.grupos WHERE id = v_grupo_id;

  RETURN row_to_json(v_grupo)::jsonb;
END;
$$;

-- Função RPC: Entrada segura por código de convite do grupo
CREATE OR REPLACE FUNCTION public.entrar_grupo_por_codigo(p_codigo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id UUID := auth.uid();
  v_grupo RECORD;
  v_membro RECORD;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Sessão não autenticada.';
  END IF;

  SELECT * INTO v_grupo 
  FROM public.grupos 
  WHERE UPPER(codigo) = UPPER(TRIM(p_codigo)) AND ativo = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Código de grupo inválido ou grupo inativo.';
  END IF;

  SELECT * INTO v_membro 
  FROM public.membros_grupo 
  WHERE grupo_id = v_grupo.id AND usuario_id = v_usuario_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', TRUE,
      'grupo_id', v_grupo.id,
      'membro_id', v_membro.id,
      'status', v_membro.status,
      'mensagem', 'Usuário já é membro ou possui solicitação pendente neste grupo.'
    );
  END IF;

  INSERT INTO public.membros_grupo (grupo_id, usuario_id, papel, status, classe)
  VALUES (v_grupo.id, v_usuario_id, 'jogador', 'pendente', NULL)
  RETURNING * INTO v_membro;

  RETURN jsonb_build_object(
    'success', TRUE,
    'grupo_id', v_grupo.id,
    'membro_id', v_membro.id,
    'status', v_membro.status,
    'mensagem', 'Solicitação de entrada enviada com sucesso.'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_grupo_com_proprietario(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_grupo_com_proprietario(TEXT, TEXT, TEXT) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.entrar_grupo_por_codigo(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.entrar_grupo_por_codigo(TEXT) TO authenticated;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) - HABILITAÇÃO
-- ==============================================================================
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracoes_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- POLÍTICAS DE RLS (ROW LEVEL SECURITY SEM REFERÊNCIAS A OLD OU NEW)
-- ==============================================================================

-- --- TABELA: usuarios ---
DROP POLICY IF EXISTS "Ver usuarios do mesmo grupo ou proprio" ON public.usuarios;
CREATE POLICY "Ver usuarios do mesmo grupo ou proprio" ON public.usuarios
  FOR SELECT USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.membros_grupo mg1
      JOIN public.membros_grupo mg2 ON mg1.grupo_id = mg2.grupo_id
      WHERE mg1.usuario_id = auth.uid() AND mg2.usuario_id = public.usuarios.id
    )
  );

DROP POLICY IF EXISTS "Inserir proprio usuario" ON public.usuarios;
CREATE POLICY "Inserir proprio usuario" ON public.usuarios
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Atualizar proprio usuario" ON public.usuarios;
CREATE POLICY "Atualizar proprio usuario" ON public.usuarios
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- --- TABELA: grupos ---
DROP POLICY IF EXISTS "Consultar grupos associados ou de interesse" ON public.grupos;
CREATE POLICY "Consultar grupos associados ou de interesse" ON public.grupos
  FOR SELECT USING (
    proprietario_id = auth.uid() OR
    public.e_membro_do_grupo(id) OR
    public.e_admin_ou_proprietario_do_grupo(id) OR
    EXISTS (SELECT 1 FROM public.membros_grupo WHERE grupo_id = public.grupos.id AND usuario_id = auth.uid())
  );

DROP POLICY IF EXISTS "Criar grupo como proprietario" ON public.grupos;
CREATE POLICY "Criar grupo como proprietario" ON public.grupos
  FOR INSERT WITH CHECK (proprietario_id = auth.uid());

DROP POLICY IF EXISTS "Atualizar grupo por admin ou proprietario" ON public.grupos;
CREATE POLICY "Atualizar grupo por admin ou proprietario" ON public.grupos
  FOR UPDATE USING (
    proprietario_id = auth.uid() OR public.e_admin_ou_proprietario_do_grupo(id)
  ) WITH CHECK (
    proprietario_id = auth.uid() OR public.e_admin_ou_proprietario_do_grupo(id)
  );

-- --- TABELA: membros_grupo ---
DROP POLICY IF EXISTS "Ver membros do grupo ou propria solicitacao" ON public.membros_grupo;
CREATE POLICY "Ver membros do grupo ou propria solicitacao" ON public.membros_grupo
  FOR SELECT USING (
    usuario_id = auth.uid() OR
    public.e_membro_do_grupo(grupo_id) OR
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Solicitar entrada em grupo como jogador pendente" ON public.membros_grupo;
CREATE POLICY "Solicitar entrada em grupo como jogador pendente" ON public.membros_grupo
  FOR INSERT WITH CHECK (
    usuario_id = auth.uid() AND
    papel = 'jogador' AND
    status = 'pendente' AND
    classe IS NULL
  );

DROP POLICY IF EXISTS "Admins podem atualizar membros" ON public.membros_grupo;
CREATE POLICY "Admins podem atualizar membros" ON public.membros_grupo
  FOR UPDATE USING (
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  ) WITH CHECK (
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Remover participacao no grupo" ON public.membros_grupo;
CREATE POLICY "Remover participacao no grupo" ON public.membros_grupo
  FOR DELETE USING (
    usuario_id = auth.uid() OR public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

-- --- TABELA: quadras ---
DROP POLICY IF EXISTS "Membros do grupo podem ver quadras" ON public.quadras;
CREATE POLICY "Membros do grupo podem ver quadras" ON public.quadras
  FOR SELECT USING (
    public.e_membro_do_grupo(grupo_id) OR public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Admins podem inserir quadras" ON public.quadras;
CREATE POLICY "Admins podem inserir quadras" ON public.quadras
  FOR INSERT WITH CHECK (public.e_admin_ou_proprietario_do_grupo(grupo_id));

DROP POLICY IF EXISTS "Admins podem atualizar quadras" ON public.quadras;
CREATE POLICY "Admins podem atualizar quadras" ON public.quadras
  FOR UPDATE USING (
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  ) WITH CHECK (
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Admins podem deletar quadras" ON public.quadras;
CREATE POLICY "Admins podem deletar quadras" ON public.quadras
  FOR DELETE USING (public.e_admin_ou_proprietario_do_grupo(grupo_id));

-- --- TABELA: horarios ---
DROP POLICY IF EXISTS "Membros do grupo podem ver horarios" ON public.horarios;
CREATE POLICY "Membros do grupo podem ver horarios" ON public.horarios
  FOR SELECT USING (
    public.e_membro_do_grupo(grupo_id) OR public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Admins podem inserir horarios" ON public.horarios;
CREATE POLICY "Admins podem inserir horarios" ON public.horarios
  FOR INSERT WITH CHECK (public.e_admin_ou_proprietario_do_grupo(grupo_id));

DROP POLICY IF EXISTS "Admins podem atualizar horarios" ON public.horarios;
CREATE POLICY "Admins podem atualizar horarios" ON public.horarios
  FOR UPDATE USING (
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  ) WITH CHECK (
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Admins podem deletar horarios" ON public.horarios;
CREATE POLICY "Admins podem deletar horarios" ON public.horarios
  FOR DELETE USING (public.e_admin_ou_proprietario_do_grupo(grupo_id));

-- --- TABELA: reservas ---
DROP POLICY IF EXISTS "Consultar reservas do grupo ou proprias" ON public.reservas;
CREATE POLICY "Consultar reservas do grupo ou proprias" ON public.reservas
  FOR SELECT USING (
    criador_id = auth.uid() OR
    adversario_id = auth.uid() OR
    public.e_membro_do_grupo(grupo_id) OR
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Membros ativos podem criar reservas" ON public.reservas;
CREATE POLICY "Membros ativos podem criar reservas" ON public.reservas
  FOR INSERT WITH CHECK (
    criador_id = auth.uid() AND
    (public.e_membro_do_grupo(grupo_id) OR public.e_admin_ou_proprietario_do_grupo(grupo_id))
  );

DROP POLICY IF EXISTS "Criadores, adversarios ou admins podem atualizar reservas" ON public.reservas;
CREATE POLICY "Criadores, adversarios ou admins podem atualizar reservas" ON public.reservas
  FOR UPDATE USING (
    criador_id = auth.uid() OR
    adversario_id = auth.uid() OR
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  ) WITH CHECK (
    criador_id = auth.uid() OR
    adversario_id = auth.uid() OR
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Admins podem deletar reservas" ON public.reservas;
CREATE POLICY "Admins podem deletar reservas" ON public.reservas
  FOR DELETE USING (public.e_admin_ou_proprietario_do_grupo(grupo_id));

-- --- TABELA: notificacoes ---
DROP POLICY IF EXISTS "Ver proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Ver proprias notificacoes" ON public.notificacoes
  FOR SELECT USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Membros podem enviar notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Admins podem inserir notificacoes" ON public.notificacoes;
CREATE POLICY "Admins podem inserir notificacoes" ON public.notificacoes
  FOR INSERT WITH CHECK (public.e_admin_ou_proprietario_do_grupo(grupo_id));

DROP POLICY IF EXISTS "Atualizar proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Atualizar proprias notificacoes" ON public.notificacoes
  FOR UPDATE USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "Deletar proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Deletar proprias notificacoes" ON public.notificacoes
  FOR DELETE USING (usuario_id = auth.uid() OR public.e_admin_ou_proprietario_do_grupo(grupo_id));

-- --- TABELA: convites ---
DROP POLICY IF EXISTS "Admins podem ver convites" ON public.convites;
CREATE POLICY "Admins podem ver convites" ON public.convites
  FOR SELECT USING (public.e_admin_ou_proprietario_do_grupo(grupo_id));

DROP POLICY IF EXISTS "Admins podem criar convites" ON public.convites;
CREATE POLICY "Admins podem criar convites" ON public.convites
  FOR INSERT WITH CHECK (public.e_admin_ou_proprietario_do_grupo(grupo_id));

DROP POLICY IF EXISTS "Admins podem atualizar convites" ON public.convites;
CREATE POLICY "Admins podem atualizar convites" ON public.convites
  FOR UPDATE USING (public.e_admin_ou_proprietario_do_grupo(grupo_id)) WITH CHECK (public.e_admin_ou_proprietario_do_grupo(grupo_id));

DROP POLICY IF EXISTS "Admins podem deletar convites" ON public.convites;
CREATE POLICY "Admins podem deletar convites" ON public.convites
  FOR DELETE USING (public.e_admin_ou_proprietario_do_grupo(grupo_id));

-- --- TABELA: configuracoes_grupo ---
DROP POLICY IF EXISTS "Membros podem ver configuracoes do grupo" ON public.configuracoes_grupo;
CREATE POLICY "Membros podem ver configuracoes do grupo" ON public.configuracoes_grupo
  FOR SELECT USING (
    public.e_membro_do_grupo(grupo_id) OR public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

DROP POLICY IF EXISTS "Admins podem gerenciar configuracoes do grupo" ON public.configuracoes_grupo;
CREATE POLICY "Admins podem gerenciar configuracoes do grupo" ON public.configuracoes_grupo
  FOR ALL USING (
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  ) WITH CHECK (
    public.e_admin_ou_proprietario_do_grupo(grupo_id)
  );

-- --- TABELA: audit_logs ---
DROP POLICY IF EXISTS "Admins podem consultar audit_logs" ON public.audit_logs;
CREATE POLICY "Admins podem consultar audit_logs" ON public.audit_logs
  FOR SELECT USING (public.e_admin_ou_proprietario_do_grupo(grupo_id));

DROP POLICY IF EXISTS "Membros e admins podem registrar audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Apenas admins podem registrar audit_logs" ON public.audit_logs;
CREATE POLICY "Apenas admins podem registrar audit_logs" ON public.audit_logs
  FOR INSERT WITH CHECK (public.e_admin_ou_proprietario_do_grupo(grupo_id));

-- ==============================================================================
-- COMPATIBILIDADE DIRETA E IDEMPOTENTE COM SUPABASE REALTIME
-- ==============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'reservas'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.reservas;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notificacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
  END IF;
END $$;

COMMIT;
