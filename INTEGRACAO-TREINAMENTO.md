# Tela de Treinamento de Fotos — reconstrução (server-side)

Reconstrução da ferramenta `treinamento-volantes.html`, porém **sem chave no cliente**.
Gerada em 25/11/2026 · base: `/home/ubuntu/apps/volante-bot-build/volante-express/`
**Nada foi commitado nem deployado.** Copie os arquivos abaixo para o repo real.

## Arquivos criados (relativos a `volante-express/`)

```
app/utils/volantesData.js                    # dados (MODELOS, FREQ_*) + calcularPrioridade()
app/api/volantes/fotos/route.js              # GET  → lista volantes_fotos por prioridade
app/api/volantes/compatibilidade/route.js    # GET  → associações; POST → salva por foto
app/admin/treinamento/page.js                # a tela (client component)
```

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

- ⚠️ O `treinamento-volantes (2).html` e o `app/admin/page.js` atual têm a **service_role hardcoded**.
  Migrar o admin para o padrão server-side (rotas `/api/*`) e **rotacionar a chave**.
