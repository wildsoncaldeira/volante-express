# Tela de Treinamento de Fotos — reconstrução (server-side)

Reconstrução da ferramenta `treinamento-volantes.html`, porém **sem chave no cliente**.
Gerada em 25/11/2026 · base: `/home/ubuntu/apps/volante-bot-build/volante-express/`
Entregue como **PR #1** (branch `feature/tela-treinamento-volantes`).

## Arquivos criados (relativos a `volante-express/`)

```
app/utils/volantesData.js                    # dados (MODELOS, FREQ_*) + calcularPrioridade()
app/utils/botSupabase.js                     # clientes server-side + requireUser() + IGNORAR
app/api/volantes/fotos/route.js              # GET  → lista volantes_fotos por prioridade
app/api/volantes/compatibilidade/route.js    # GET  → associações; POST → salva por foto
app/admin/treinamento/page.js                # a tela (client component)
```

## Autenticação

Todas as rotas `/api/volantes/*` exigem `Authorization: Bearer <access_token>` (JWT do Supabase
Auth do app). `requireUser()` valida o token contra o projeto **principal** (`NEXT_PUBLIC_SUPABASE_URL`)
e retorna 401 se faltar/for inválido. A página manda o token da sessão (`supabase.auth.getSession()`)
e redireciona pra `/login` se não houver sessão. **Só usuário logado** (o app hoje não tem papel de admin).

## Gravação atômica + "irrelevante"

- O `POST` **insere primeiro** o novo conjunto e só depois apaga as linhas antigas que não estão nele
  (se o insert falhar, nada é perdido).
- Marcar "não é volante / irrelevante" grava a sentinela `modelo_cliente = '__IGNORAR__'`.
  **O bot/MCP deve ignorar linhas com `modelo_cliente = '__IGNORAR__'`.**

## Diferenças vs. o HTML original

| HTML original | Reconstrução |
|---|---|
| `SUPABASE_KEY` (service_role) hardcoded no cliente | **nada de chave no cliente**; tudo por `/api/volantes/*` (Node/server) |
| Gera um bloco de SQL pra colar manualmente | **salva direto** no Supabase via `POST /api/volantes/compatibilidade` (substitui por `foto_id`, idempotente) |
| Sem associações já salvas | carrega o que já existe (`GET`) e pré-preenche a foto |
| IDs aleatórios só na sessão | "copiar de foto treinada" busca pelo **ID real** da foto (`volantes_fotos.id`) |

## Variáveis de ambiente (no SERVIDOR, não `NEXT_PUBLIC`)

```
SUPABASE_BOT_URL=https://sgijvaejapabhivkhwwl.supabase.co
SUPABASE_BOT_SERVICE_KEY=<service_role do projeto do bot>
```

Sem essas duas o `GET` responde 500 com mensagem clara.

## Como integrar no volante-express

1. Copiar os 4 arquivos para os caminhos equivalentes no repo.
2. Garantir as 2 envs acima no `.env.local` do VPS (e nas env do PM2).
3. Acessar: `https://app.volanteexpress.com/admin/treinamento`
   (ou criar um link/aba no `app/admin/page.js` apontando pra `/admin/treinamento`).

## Verificação já feita (contra o Supabase real)

- `calcularPrioridade` + ranking: **374 fotos**, topo `CHEVROLET/onix = 195`.
- Agrupamento de `volantes_compatibilidade`: **114 linhas → 57 fotos**, exemplo `foto 39 → Celta`.
- Catálogo de modelos: **121**.
- `node --check` nas rotas/utilitário: OK. JSX validado com esbuild: OK.
- **Não testado**: build completo do Next + clique real na UI (depende de `npm install`/envs no repo). Testar após merge.

## Pendências relacionadas (segurança)

- ⚠️ O `treinamento-volantes (2).html` original tem a **`service_role` hardcoded** → **rotacionar** aquela chave.
- O `app/admin/page.js` de produção usa a chave **`anon`** (claim `role: anon`), não `service_role`.
  Uma `anon` no cliente é normal; o risco depende das **RLS** do projeto do bot — vale conferir.
  (Correção: a versão anterior deste doc dizia "service_role" no admin — era **incorreto**.)
