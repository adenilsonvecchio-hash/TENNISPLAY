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
