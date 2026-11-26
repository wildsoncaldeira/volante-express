// app/utils/botSupabase.js
// Clientes Supabase server-side do app. NENHUMA chave privilegiada vai ao cliente.
import { createClient } from '@supabase/supabase-js';

// Sentinela: marca uma foto como "não é volante / irrelevante".
// O bot (MCP) deve ignorar linhas com modelo_cliente = IGNORAR.
export const IGNORAR = '__IGNORAR__';

// Cliente do projeto do BOT (tabelas volantes_*, bot_*), com service_role.
export function botServiceClient() {
  const url = process.env.SUPABASE_BOT_URL;
  const key = process.env.SUPABASE_BOT_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Defina SUPABASE_BOT_URL e SUPABASE_BOT_SERVICE_KEY no servidor (.env).');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Cliente do projeto PRINCIPAL do app (Auth/profiles) — só para validar o token.
function appAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Exige um usuário autenticado (Authorization: Bearer <access_token>).
// Valida o JWT contra o projeto principal (o mesmo do login do app).
// Lança erro com status 401 se faltar/inválido.
export async function requireUser(req) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) {
    const e = new Error('Não autenticado'); e.status = 401; throw e;
  }
  const { data, error } = await appAuthClient().auth.getUser(token);
  if (error || !data?.user) {
    const e = new Error('Sessão inválida'); e.status = 401; throw e;
  }
  // Opcional: se ADMIN_EMAILS (lista separada por vírgula) existir no servidor,
  // só esses e-mails podem usar as rotas. Sem a env, qualquer usuário logado passa.
  const permitidos = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (permitidos.length && !permitidos.includes((data.user.email || '').toLowerCase())) {
    const e = new Error('Sem permissão'); e.status = 403; throw e;
  }
  return data.user;
}

// Exige um ADMIN. Além do token válido, ADMIN_EMAILS (CSV) é OBRIGATÓRIA —
// se não estiver definida no servidor, falha fechado (503). Use nas rotas
// administrativas que acessam dados com service_role.
export async function requireAdmin(req) {
  const user = await requireUser(req);
  const permitidos = (process.env.ADMIN_EMAILS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!permitidos.length) {
    const e = new Error('ADMIN_EMAILS não configurado no servidor'); e.status = 503; throw e;
  }
  if (!permitidos.includes((user.email || '').toLowerCase())) {
    const e = new Error('Sem permissão'); e.status = 403; throw e;
  }
  return user;
}

// ── Papéis do painel (item 17.5) ─────────────────────────────────────────────
// admin   = e-mails em ADMIN_EMAILS (tudo)
// operador = e-mails em OPERATOR_EMAILS (Conversas, controle por contato,
//            Sugestões, Sombra, Avisos, FAQ/Objeções). Validado SEMPRE no servidor.
const listaEmails = (v) => (v || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);

export function papelDoEmail(email) {
  const e = (email || '').toLowerCase();
  if (!e) return null;
  if (listaEmails(process.env.ADMIN_EMAILS).includes(e)) return 'admin';
  if (listaEmails(process.env.OPERATOR_EMAILS).includes(e)) return 'operador';
  return null;
}

// Exige um usuário logado com um dos papéis. Falha fechado: sem ADMIN_EMAILS → 503.
// Devolve { user, papel }.
export async function requirePapel(req, papeis = ['admin']) {
  if (!listaEmails(process.env.ADMIN_EMAILS).length) {
    const e = new Error('ADMIN_EMAILS não configurado no servidor'); e.status = 503; throw e;
  }
  const header = req.headers.get('authorization') || req.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) { const e = new Error('Não autenticado'); e.status = 401; throw e; }
  const { data, error } = await appAuthClient().auth.getUser(token);
  if (error || !data?.user) { const e = new Error('Sessão inválida'); e.status = 401; throw e; }
  const papel = papelDoEmail(data.user.email);
  if (!papel || !papeis.includes(papel)) { const e = new Error('Sem permissão'); e.status = 403; throw e; }
  return { user: data.user, papel };
}

export function erroJson(e) {
  return Response.json({ error: e.message || 'Erro interno' }, { status: e.status || 500 });
}