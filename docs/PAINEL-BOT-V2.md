# Painel do bot v2 (PR `feat/painel-bot-v2`)

**Depende da migração `supabase/bot-v2-migration.sql` do repo `whatsapp-bot-volante`. Aplique-a antes de usar as subabas novas.**

## Variáveis de ambiente (servidor do painel)
| Env | Para quê |
|---|---|
| `ADMIN_EMAILS` | e-mails admin (obrigatória; sem ela a API responde 503) |
| `OPERATOR_EMAILS` | e-mails operador (ex.: Maria Luísa). Veem só Conversas, controle por contato, Sugestões, Sombra, Avisos, FAQ e Objeções |
| `GHL_API_KEY`, `GHL_LOCATION_ID`, `GHL_BASE_URL` (opc.) | mesmas do bot. Usadas no servidor para: endereço do local (Agenda), tags `bot-off`/`bot-ativo`, link da conversa. Sem elas as telas funcionam sem esses dados |
| `BOT_TEST_SECRET`, `BOT_TEST_URL` (opc.) | Simulador dry-run: chama `POST {BOT_TEST_URL}/api/bot/test` com header `x-bot-test-secret` e corpo `{phone, message, dry_run:true}` |

## Rotas
- `/admin` → aba Bot (admin). `/admin/bot` → painel do bot em tela cheia (home do operador; o operador é redirecionado para lá).
- `/api/admin/bot` — toda leitura/escrita passa por aqui; papel validado no servidor (`requirePapel`). Chaves de `bot_config` validadas em `app/utils/botConfig.js`; toda alteração vai para `bot_config_audit`.
- O token de `bot_instances` nunca sai do servidor (a API devolve `••••abcd`).
