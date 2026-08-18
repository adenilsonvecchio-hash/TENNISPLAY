# Agenda do Tênis — Supabase central

Aplicativo React + TypeScript + Vite conectado exclusivamente ao Supabase.

## Configuração

1. Instale as dependências com `npm install`.
2. Configure no ambiente de execução:

```env
VITE_SUPABASE_URL=https://slugmpepkblrknxpncvw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sua_publishable_key
```

3. O projeto Supabase precisa possuir o esquema oficial com as tabelas:
   `usuarios`, `grupos`, `membros_grupo`, `quadras`, `horarios`, `reservas`,
   `notificacoes` e `audit_logs`.
4. Execute `npm run dev` para desenvolvimento ou `npm run build` para produção.

## Arquitetura

- Supabase Auth controla cadastro, login, sessão e troca de senha.
- PostgreSQL com RLS é a única fonte dos dados de negócio.
- Realtime atualiza reservas, membros e notificações.
- Não existe Express, `db.json`, banco local ou fallback com dados fictícios.
- A configuração do Supabase não é gravada manualmente no navegador.

## Verificação

```bash
npm run lint
npm run build
```

Antes de liberar usuários, faça um teste real com duas contas e dois aparelhos.
