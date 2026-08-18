-- ==============================================================================
-- TennisPlay - Migração 010: Criação do Bucket 'avatars' e Políticas de Storage
-- Arquivo: supabase/migrations/010_criar_bucket_avatars_e_politicas.sql
-- ==============================================================================

-- 1. Garante que o bucket 'avatars' existe com visibilidade pública
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 2. Habilita RLS em storage.objects se ainda não estiver habilitado
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. Remove políticas anteriores do bucket 'avatars' para recriação limpa
DROP POLICY IF EXISTS "Avatares de jogadores sao publicos para visualizacao" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados podem visualizar avatares" ON storage.objects;
DROP POLICY IF EXISTS "Jogadores podem enviar avatar para sua propria pasta" ON storage.objects;
DROP POLICY IF EXISTS "Jogadores podem atualizar seu proprio avatar" ON storage.objects;
DROP POLICY IF EXISTS "Jogadores podem excluir seu proprio avatar" ON storage.objects;

-- 4. POLÍTICA DE LEITURA (SELECT): Qualquer usuário autenticado ou anônimo pode visualizar os avatares públicos
CREATE POLICY "Avatares de jogadores sao publicos para visualizacao"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- 5. POLÍTICA DE INSERÇÃO (INSERT): Usuário autenticado só pode enviar fotos para sua própria pasta (pasta = auth.uid())
CREATE POLICY "Jogadores podem enviar avatar para sua propria pasta"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    name LIKE auth.uid()::text || '/%'
  )
);

-- 6. POLÍTICA DE ATUALIZAÇÃO (UPDATE): Usuário autenticado só pode atualizar fotos na sua própria pasta
CREATE POLICY "Jogadores podem atualizar seu proprio avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    name LIKE auth.uid()::text || '/%'
  )
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    name LIKE auth.uid()::text || '/%'
  )
);

-- 7. POLÍTICA DE EXCLUSÃO (DELETE): Usuário autenticado só pode excluir fotos da sua própria pasta
CREATE POLICY "Jogadores podem excluir seu proprio avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (
    (storage.foldername(name))[1] = auth.uid()::text OR
    name LIKE auth.uid()::text || '/%'
  )
);
