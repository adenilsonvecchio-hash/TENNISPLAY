-- ==========================================
-- TENNISPLAY - SCRIPT COMPLETO SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase
-- ==========================================

-- 1. Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de Usuários (sincronizada com auth.users)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    email TEXT UNIQUE,
    whatsapp TEXT,
    avatar_url TEXT,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Trigger para criar registro em public.usuarios automaticamente ao cadastrar em auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.usuarios (id, nome, email, whatsapp, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'whatsapp', ''),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        whatsapp = EXCLUDED.whatsapp,
        avatar_url = EXCLUDED.avatar_url;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Tabela de Grupos
CREATE TABLE IF NOT EXISTS public.grupos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome TEXT NOT NULL,
    codigo TEXT UNIQUE NOT NULL,
    descricao TEXT,
    logo_url TEXT,
    proprietario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    permite_convidado BOOLEAN DEFAULT TRUE,
    default_qtd_quadras INTEGER DEFAULT 4,
    prazo_cancelamento_horas INTEGER DEFAULT 2,
    ativo BOOLEAN DEFAULT TRUE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Membros dos Grupos
CREATE TABLE IF NOT EXISTS public.membros_grupo (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    papel TEXT NOT NULL DEFAULT 'jogador', -- 'proprietario', 'administrador', 'jogador'
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'ativo', 'bloqueado'
    classe TEXT, -- Ex: '1', '2', '3', 'A', 'B'
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, grupo_id)
);

-- Trigger para adicionar o proprietário como membro ativo automaticamente ao criar grupo
CREATE OR REPLACE FUNCTION public.handle_new_group()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.proprietario_id IS NOT NULL THEN
        INSERT INTO public.membros_grupo (usuario_id, grupo_id, papel, status)
        VALUES (NEW.proprietario_id, NEW.id, 'proprietario', 'ativo')
        ON CONFLICT (usuario_id, grupo_id) DO UPDATE SET
            papel = 'proprietario',
            status = 'ativo';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_group_created ON public.grupos;
CREATE TRIGGER on_group_created
    AFTER INSERT ON public.grupos
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_group();

-- 6. Tabela de Quadras
CREATE TABLE IF NOT EXISTS public.quadras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    nome TEXT NOT NULL,
    ativa BOOLEAN DEFAULT TRUE,
    UNIQUE(grupo_id, numero)
);

-- 7. Tabela de Horários
CREATE TABLE IF NOT EXISTS public.horarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    hora_inicio TIME NOT NULL,
    hora_fim TIME NOT NULL,
    turno TEXT DEFAULT 'manha', -- 'manha', 'tarde', 'noite'
    ativo BOOLEAN DEFAULT TRUE,
    UNIQUE(grupo_id, hora_inicio, hora_fim)
);

-- 8. Tabela de Reservas
CREATE TABLE IF NOT EXISTS public.reservas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID NOT NULL REFERENCES public.grupos(id) ON DELETE CASCADE,
    quadra_id UUID NOT NULL REFERENCES public.quadras(id) ON DELETE CASCADE,
    horario_id UUID NOT NULL REFERENCES public.horarios(id) ON DELETE CASCADE,
    data DATE NOT NULL,
    criador_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    criador_classe TEXT,
    nome_convidado TEXT,
    status TEXT NOT NULL DEFAULT 'confirmada', -- 'aguardando', 'confirmada', 'cancelada'
    criado_em TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT reservation_no_double_booking UNIQUE (quadra_id, data, horario_id, status)
);

-- 9. Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    grupo_id UUID REFERENCES public.grupos(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL,
    mensagem TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'INFO', -- 'INFO', 'RESERVA', 'SISTEMA', 'ALERTA'
    lida BOOLEAN DEFAULT FALSE,
    criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Habilitar RLS (Row Level Security) e Criar Políticas de Acesso
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membros_grupo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quadras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- Remover políticas anteriores se existirem
DROP POLICY IF EXISTS "Acesso Livre Usuarios" ON public.usuarios;
DROP POLICY IF EXISTS "Acesso Livre Grupos" ON public.grupos;
DROP POLICY IF EXISTS "Acesso Livre Membros" ON public.membros_grupo;
DROP POLICY IF EXISTS "Acesso Livre Quadras" ON public.quadras;
DROP POLICY IF EXISTS "Acesso Livre Horarios" ON public.horarios;
DROP POLICY IF EXISTS "Acesso Livre Reservas" ON public.reservas;
DROP POLICY IF EXISTS "Acesso Livre Notificacoes" ON public.notificacoes;

-- Criar Políticas de Acesso Livre (para leitura e escrita das tabelas da aplicação)
CREATE POLICY "Acesso Livre Usuarios" ON public.usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Livre Grupos" ON public.grupos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Livre Membros" ON public.membros_grupo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Livre Quadras" ON public.quadras FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Livre Horarios" ON public.horarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Livre Reservas" ON public.reservas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso Livre Notificacoes" ON public.notificacoes FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Publicação Realtime para Reservas e Notificações (Sem erros caso já estejam ativas)
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

-- 11. Função de Verificação de Proprietário
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

-- 12. Trigger para Restringir Alteração de Classe (Exclusivo para Proprietário)
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
  v_is_owner := public.e_proprietario_do_grupo(OLD.grupo_id);

  IF NEW.usuario_id IS DISTINCT FROM OLD.usuario_id OR NEW.grupo_id IS DISTINCT FROM OLD.grupo_id THEN
    RAISE EXCEPTION 'Não é permitido alterar usuario_id ou grupo_id do vínculo.';
  END IF;

  -- Regra mandatória: Apenas proprietário pode alterar classe
  IF OLD.classe IS DISTINCT FROM NEW.classe AND NOT v_is_owner THEN
    RAISE EXCEPTION 'Permissão negada: apenas o proprietário do grupo pode definir ou alterar a classe de qualquer jogador.';
  END IF;

  IF OLD.usuario_id = v_current_user_id AND NOT v_is_owner THEN
    IF OLD.papel IS DISTINCT FROM NEW.papel OR
       OLD.status IS DISTINCT FROM NEW.status OR
       OLD.classe IS DISTINCT FROM NEW.classe THEN
      RAISE EXCEPTION 'Não é permitido alterar o próprio papel, status ou classe.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_update_membros_grupo ON public.membros_grupo;
CREATE TRIGGER trg_validar_update_membros_grupo
  BEFORE UPDATE ON public.membros_grupo
  FOR EACH ROW EXECUTE FUNCTION public.validar_update_membros_grupo();

-- 13. RPC Segura: alterar_classe_jogador
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
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Acesso não autorizado: usuário não autenticado.';
  END IF;

  SELECT * INTO v_membro
  FROM public.membros_grupo
  WHERE (id = p_membro_id OR usuario_id = p_membro_id) AND grupo_id = p_grupo_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jogador não encontrado no grupo especificado.';
  END IF;

  v_is_owner := public.e_proprietario_do_grupo(p_grupo_id);
  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Apenas o proprietário do grupo pode alterar a classe dos jogadores.';
  END IF;

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

-- 14. RPC Atômica e Segura: criar_reserva
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
BEGIN
  -- 1. Validar autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Sua sessão expirou. Entre novamente.';
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

  -- 3. Obter e validar a quadra do grupo (por ID se fornecido, ou por número no grupo)
  IF p_quadra_id IS NOT NULL THEN
    SELECT * INTO v_quadra
    FROM public.quadras
    WHERE id = p_quadra_id AND grupo_id = p_grupo_id AND ativa = TRUE;
  END IF;

  IF v_quadra IS NULL THEN
    SELECT * INTO v_quadra
    FROM public.quadras
    WHERE grupo_id = p_grupo_id AND numero = p_quadra_numero AND ativa = TRUE;
  END IF;

  IF v_quadra IS NULL THEN
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
      WHERE grupo_id = p_grupo_id AND numero = p_quadra_numero AND ativa = TRUE;
    END IF;

    IF v_quadra IS NULL THEN
      RAISE EXCEPTION 'Esta quadra não está disponível nesta data.';
    END IF;
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
      RAISE EXCEPTION 'Este horário não está mais disponível.';
    END IF;
  END IF;

  -- 5. Verificar conflito de reserva (concorrência)
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

  -- 6. Inserir a reserva atomicamente
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

REVOKE EXECUTE ON FUNCTION public.criar_reserva(UUID, DATE, INT, TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_reserva(UUID, DATE, INT, TEXT, TEXT, TEXT, UUID) TO authenticated;


