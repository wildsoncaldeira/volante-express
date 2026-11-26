// app/api/admin/bot/route.js
// Painel do bot (bot_config, FAQs, objeções, sugestões, sombra, avisos, agenda,
// conversas, instâncias WhatsApp…) feito NO SERVIDOR — o navegador nunca vê a chave
// do Supabase, o token das instâncias nem a chave do GHL.
//
// Papéis (validados aqui, não só escondendo botões):
//   admin    → tudo
//   operador → Conversas, controle por contato (pausar/retomar), Sugestões, Sombra,
//              Avisos (só leitura), FAQ e Objeções
import { NextResponse } from 'next/server';
import { botServiceClient, requirePapel } from '../../../utils/botSupabase';
import { parseAgendaTexto, paraISO, chaveCidade } from '../../../utils/agendaTexto';
import { parseObjecoesTexto, splitGatilhos, normAcao, variaveisDesconhecidas } from '../../../utils/objecoesTexto';
import { chavePermitida, validarConfig, validarLote, HHMM, ult8 } from '../../../utils/botConfig';
import { enderecoDoCalendario, sincronizarTags, tagsDoContato, linkContatoGhl, ghlConfigurado, UA_NAVEGADOR } from '../../../utils/ghlServer';
import { validarBaseUrl, garantirHostPublico, mascararToken, higienizar } from '../../../utils/urlSegura';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const noStore = { 'Cache-Control': 'no-store' };

const ADMIN = ['admin'];
const STAFF = ['admin', 'operador'];

const asStr = (v) => (typeof v === 'string' ? v : null);
const asId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
class Invalido extends Error {}
const bad = (msg) => { throw new Invalido(msg); };
const json = (obj, status = 200) => NextResponse.json(obj, { status, headers: noStore });

// Consulta opcional: se a tabela ainda não existe (migração não aplicada) devolve [] e marca.
async function opcional(promessa, nome, faltando) {
  try {
    const { data, error } = await promessa;
    if (error) { faltando.push(nome); return []; }
    return data || [];
  } catch { faltando.push(nome); return []; }
}

// ───────────────────────── bot_config + auditoria ─────────────────────────
async function lerConfig(supabase, chaves) {
  const { data, error } = await supabase.from('bot_config').select('key, value').in('key', chaves);
  if (error) throw error;
  return Object.fromEntries((data || []).map((r) => [r.key, r.value]));
}

// Valida, grava e audita. `payload` = [{key, value}]. Só audita o que mudou.
async function gravarConfig(supabase, payload, quem) {
  if (!Array.isArray(payload) || !payload.length) bad('payload inválido');
  if (payload.length > 80) bad('itens demais');
  const mapa = {};
  for (const item of payload) {
    const key = asStr(item?.key);
    const value = asStr(item?.value);
    if (!key || value === null) bad('item de config inválido');
    if (!chavePermitida(key)) bad(`chave não permitida: ${key}`);
    try { mapa[key] = validarConfig(key, value); } catch (e) { bad(e.message); }
  }
  try { validarLote(mapa); } catch (e) { bad(e.message); }
  const chaves = Object.keys(mapa);
  const antes = await lerConfig(supabase, chaves);
  const mudou = chaves.filter((k) => (antes[k] ?? null) !== mapa[k]);
  if (!mudou.length) return { alteradas: [] };
  const { error } = await supabase.from('bot_config').upsert(mudou.map((key) => ({ key, value: mapa[key] })), { onConflict: 'key' });
  if (error) throw error;
  const { error: eAud } = await supabase.from('bot_config_audit').insert(
    mudou.map((chave) => ({ quem, chave, valor_antigo: antes[chave] ?? null, valor_novo: mapa[chave] })),
  );
  // A config já foi gravada; se a auditoria falhar (tabela ausente) avisa, sem esconder.
  return { alteradas: mudou, auditoria: eAud ? `config gravada, mas a auditoria falhou: ${eAud.message}` : undefined };
}

const hojeBRT0 = () => {
  const d = new Date(Date.now() - 3 * 3600 * 1000); // America/Sao_Paulo (sem horário de verão)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 0, 0)).toISOString();
};
const diasAtras = (n) => new Date(Date.now() - n * 86400000).toISOString();

// ───────────────────────── GET ─────────────────────────
const RECURSOS = {
  // recurso: [papéis, função(supabase, params, ctx)]
  me: [STAFF, async (_s, _p, ctx) => ({ papel: ctx.papel, email: ctx.user.email, ghl: ghlConfigurado() })],

  config: [ADMIN, async (s) => {
    const { data, error } = await s.from('bot_config').select('key, value');
    if (error) throw error;
    return (data || []).filter((r) => chavePermitida(r.key));
  }],

  faqs: [STAFF, async (s) => {
    const { data, error } = await s.from('bot_faqs').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }],

  objecoes: [STAFF, async (s) => {
    const { data, error } = await s.from('bot_objections').select('*').order('ordem', { ascending: true }).order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  }],

  calendarios: [ADMIN, async (s) => {
    const { data, error } = await s.from('bot_calendars').select('*').order('city', { ascending: true });
    if (error) throw error;
    const lista = data || [];
    // Endereço vem do calendário do GHL (somente leitura). Em lotes pequenos.
    const out = [];
    for (let i = 0; i < lista.length; i += 6) {
      const lote = await Promise.all(lista.slice(i, i + 6).map(async (c) => ({
        ...c, endereco_ghl: await enderecoDoCalendario(c.calendar_id),
      })));
      out.push(...lote);
    }
    return out;
  }],

  sugestoes: [STAFF, async (s, p) => {
    const status = p.get('status') || 'pendente';
    let q = s.from('bot_learning_suggestions').select('*').order('created_at', { ascending: false }).limit(300);
    if (status !== 'todas') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data || [];
  }],

  sombra: [STAFF, async (s, p) => {
    const filtro = p.get('filtro') || 'pendentes';
    let q = s.from('bot_shadow_log').select('*').order('created_at', { ascending: false }).limit(200);
    if (filtro === 'pendentes') q = q.is('avaliacao', null);
    else if (['acertou', 'errou', 'virar_faq'].includes(filtro)) q = q.eq('avaliacao', filtro);
    const { data, error } = await q;
    if (error) throw error;
    // Taxa de acerto da semana = acertou / (acertou + errou) entre as avaliadas.
    const { data: sem, error: e2 } = await s.from('bot_shadow_log').select('avaliacao').gte('created_at', diasAtras(7)).not('avaliacao', 'is', null).limit(5000);
    if (e2) throw e2;
    const c = { acertou: 0, errou: 0, virar_faq: 0 };
    for (const r of sem || []) if (r.avaliacao in c) c[r.avaliacao] += 1;
    const base = c.acertou + c.errou;
    return { itens: data || [], semana: { ...c, avaliadas: base + c.virar_faq, taxa_acerto: base ? Math.round((c.acertou / base) * 1000) / 10 : null } };
  }],

  avisos: [STAFF, async (s, p) => {
    const periodo = p.get('periodo') || '7d';
    const motivo = p.get('motivo') || '';
    const status = p.get('status') || '';
    const modo = p.get('modo') || '';
    let q = s.from('bot_handoffs').select('*').order('created_at', { ascending: false }).limit(300);
    if (periodo === 'hoje') q = q.gte('created_at', hojeBRT0());
    else if (periodo === '7d') q = q.gte('created_at', diasAtras(7));
    else if (periodo === '30d') q = q.gte('created_at', diasAtras(30));
    if (motivo) q = q.eq('motivo', motivo);
    if (status) q = q.eq('status_entrega', status);
    if (modo) q = q.eq('modo', modo);
    const { data, error } = await q;
    if (error) throw error;
    // Contadores de HOJE (independentes dos filtros).
    const { data: hoje, error: e2 } = await s.from('bot_handoffs').select('status_entrega, modo, motivo').gte('created_at', hojeBRT0()).limit(5000);
    if (e2) throw e2;
    const cont = { total: 0, enviados: 0, na_fila: 0, suprimidos: 0, erros: 0 };
    for (const r of hoje || []) {
      cont.total += 1;
      const st = r.status_entrega || '';
      if (st === 'enviado' || st === 'enviado_no_resumo') cont.enviados += 1;
      else if (st === 'na_fila_resumo' || st === 'na_fila') cont.na_fila += 1;
      else if (st.startsWith('suprimido')) cont.suprimidos += 1;
      else if (st === 'erro_envio') cont.erros += 1;
    }
    const itens = (data || []).map((h) => ({ ...h, ghl_link: h.ghl_link || linkContatoGhl(h.contact_id) }));
    return { itens, hoje: cont };
  }],

  conversas: [STAFF, async (s) => {
    const faltando = [];
    const { data: msgs, error } = await s.from('bot_conversations').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    const chats = [...new Set((msgs || []).map((m) => m.contact_id))];
    const leads = chats.length ? await opcional(s.from('bot_leads').select('chatid, name, phone, city, paused_until, ghl_contact_id').in('chatid', chats), 'bot_leads', faltando) : [];
    const skips = await opcional(s.from('bot_events').select('chatid, detalhe, created_at').eq('tipo', 'skip').order('created_at', { ascending: false }).limit(1000), 'bot_events', faltando);
    const abertos = await opcional(s.from('bot_handoffs').select('id, chatid, contact_id, motivo, status_entrega, modo, created_at, ghl_link').is('resolved_at', null).order('created_at', { ascending: false }).limit(500), 'bot_handoffs', faltando);
    const ultimoSkip = {};
    for (const e of skips) if (e.chatid && !ultimoSkip[e.chatid]) ultimoSkip[e.chatid] = { motivo: e.detalhe?.motivo || null, em: e.created_at };
    const leadPor = Object.fromEntries(leads.map((l) => [l.chatid, { ...l, ghl_link: linkContatoGhl(l.ghl_contact_id) }]));
    const handoffsPor = {};
    for (const h of abertos) (handoffsPor[h.chatid] ||= []).push({ ...h, ghl_link: h.ghl_link || linkContatoGhl(h.contact_id) });
    // Resumo do dia (15.11) a partir de bot_events.
    const ev = await opcional(s.from('bot_events').select('tipo, detalhe').gte('created_at', hojeBRT0()).limit(5000), 'bot_events', faltando);
    const dia = { respostas: 0, agendamentos: 0, handoffs: 0, erros_ia: 0, guardrails: 0, skips: {} };
    for (const e of ev) {
      if (e.tipo === 'resposta') dia.respostas += 1;
      else if (e.tipo === 'agendamento') dia.agendamentos += 1;
      else if (e.tipo === 'handoff') dia.handoffs += 1;
      else if (e.tipo === 'erro_ia') dia.erros_ia += 1;
      else if (e.tipo === 'guardrail') dia.guardrails += 1;
      else if (e.tipo === 'skip') { const m = e.detalhe?.motivo || 'outro'; dia.skips[m] = (dia.skips[m] || 0) + 1; }
    }
    return { mensagens: msgs || [], leads: leadPor, ultimo_skip: ultimoSkip, handoffs_abertos: handoffsPor, dia, faltando: [...new Set(faltando)] };
  }],

  contatos: [STAFF, async (s, p) => {
    const q = (p.get('q') || '').trim();
    if (q.length < 2) return { itens: [] };
    const limpo = q.replace(/[%,()*]/g, ' ').trim();
    const digitos = q.replace(/\D/g, '');
    const filtros = [`name.ilike.%${limpo}%`];
    if (digitos.length >= 4) filtros.push(`phone.ilike.%${digitos}%`, `chatid.ilike.%${digitos}%`);
    const { data, error } = await s.from('bot_leads').select('chatid, name, phone, city, paused_until, ghl_contact_id, updated_at').or(filtros.join(',')).order('updated_at', { ascending: false }).limit(15);
    if (error) throw error;
    const cfg = await lerConfig(s, ['ignore_numbers']);
    const ignorados = (cfg.ignore_numbers || '').split(',').map(ult8).filter(Boolean);
    const faltando = [];
    const abertos = (data || []).length ? await opcional(s.from('bot_handoffs').select('chatid').is('resolved_at', null).in('chatid', data.map((l) => l.chatid)), 'bot_handoffs', faltando) : [];
    const comHandoff = new Set(abertos.map((h) => h.chatid));
    const agora = Date.now();
    const itens = await Promise.all((data || []).map(async (l) => {
      const tags = await tagsDoContato(l.ghl_contact_id);
      let status = 'ativo';
      if (ignorados.includes(ult8(l.phone || l.chatid))) status = 'ignorado';
      else if ((l.paused_until && new Date(l.paused_until).getTime() > agora) || (tags || []).includes('bot-off')) status = 'pausado';
      else if (comHandoff.has(l.chatid)) status = 'aguardando_humano';
      return { ...l, status, tags_ghl: tags, ghl_link: linkContatoGhl(l.ghl_contact_id) };
    }));
    return { itens };
  }],

  auditoria: [ADMIN, async (s) => {
    const { data, error } = await s.from('bot_config_audit').select('*').order('created_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }],

  // Quem desligou o bot por último (para o botão PARAR TUDO).
  parada: [ADMIN, async (s) => {
    const { data } = await s.from('bot_config_audit').select('quem, valor_novo, created_at').eq('chave', 'bot_enabled').order('created_at', { ascending: false }).limit(1);
    return data?.[0] || null;
  }],

  instancias: [ADMIN, async (s) => {
    const { data, error } = await s.from('bot_instances').select('*').order('id', { ascending: true });
    if (error) throw error;
    // O token NUNCA sai do servidor: só a versão mascarada.
    return (data || []).map(({ token, ...resto }) => ({ ...resto, token_mascarado: mascararToken(token) }));
  }],

  // Gasto de IA (tokens × preço, registrado pelo bot em bot_events tipo 'custo') e saúde.
  custo: [ADMIN, async (s) => {
    const cfg = await lerConfig(s, ['usd_brl', 'ia_teto_dia_brl', 'ia_teto_mes_brl']);
    const usdBrl = Number(cfg.usd_brl) || 0;
    const agoraBRT = new Date(Date.now() - 3 * 3600 * 1000);
    const ini = new Date(Date.UTC(agoraBRT.getUTCFullYear(), agoraBRT.getUTCMonth(), 1, 3)).toISOString();
    const hoje0 = hojeBRT0();
    let usdDia = 0; let usdMes = 0; let chamadas = 0;
    for (let pg = 0; pg < 30; pg += 1) {
      const { data, error } = await s.from('bot_events').select('detalhe, created_at').eq('tipo', 'custo').gte('created_at', ini).order('created_at', { ascending: false }).range(pg * 1000, pg * 1000 + 999);
      if (error) throw error;
      for (const e of data || []) {
        const u = Number(e.detalhe?.usd) || 0;
        usdMes += u; chamadas += 1;
        if (e.created_at >= hoje0) usdDia += u;
      }
      if (!data || data.length < 1000) break;
    }
    return {
      usd_brl: usdBrl || null, chamadas_mes: chamadas,
      dia_brl: usdBrl ? Math.round(usdDia * usdBrl * 100) / 100 : null,
      mes_brl: usdBrl ? Math.round(usdMes * usdBrl * 100) / 100 : null,
      teto_dia_brl: cfg.ia_teto_dia_brl ? Number(cfg.ia_teto_dia_brl) : null,
      teto_mes_brl: cfg.ia_teto_mes_brl ? Number(cfg.ia_teto_mes_brl) : null,
    };
  }],

  saude: [ADMIN, async (s) => {
    const ultimo = async (tipo) => {
      const { data } = await s.from('bot_events').select('created_at').eq('tipo', tipo).order('created_at', { ascending: false }).limit(1);
      return data?.[0]?.created_at || null;
    };
    const { count } = await s.from('bot_events').select('id', { count: 'exact', head: true }).eq('tipo', 'erro_ia').gte('created_at', diasAtras(1));
    return { ultimo_webhook: await ultimo('webhook'), ultimo_envio: await ultimo('envio'), erros_ia_24h: count ?? null };
  }],
};

export async function GET(req) {
  try {
    const params = new URL(req.url).searchParams;
    const recurso = params.get('recurso') || 'config';
    const def = RECURSOS[recurso];
    if (!def) return json({ error: 'recurso inválido' }, 400);
    const ctx = await requirePapel(req, def[0]);
    const data = await def[1](botServiceClient(), params, ctx);
    return json({ data });
  } catch (e) {
    return json({ error: e.message }, e instanceof Invalido ? 400 : e.status || 500);
  }
}

// ───────────────────────── POST ─────────────────────────
const MAPS_HOSTS = ['google.com', 'google.com.br', 'maps.app.goo.gl', 'goo.gl', 'maps.google.com', 'g.co'];
function validarMapsUrl(v) {
  const t = String(v ?? '').trim();
  if (!t) return null;
  if (/^-?\d{1,3}(\.\d+)?\s*,\s*-?\d{1,3}(\.\d+)?$/.test(t)) {
    const [la, lo] = t.split(',').map((x) => Number(x.trim()));
    if (Math.abs(la) > 90 || Math.abs(lo) > 180) bad('coordenadas fora do intervalo');
    return `${la},${lo}`;
  }
  let u;
  try { u = new URL(t); } catch { bad('maps_url: use um link do Google Maps ou "lat,lng"'); }
  if (u.protocol !== 'https:') bad('maps_url deve ser https');
  const h = u.hostname.toLowerCase();
  if (!MAPS_HOSTS.some((d) => h === d || h.endsWith('.' + d))) bad('maps_url: só links do Google Maps (google.com / maps.app.goo.gl) ou "lat,lng"');
  return u.toString().slice(0, 500);
}

const textoObrig = (v, nome, max) => {
  const t = asStr(v)?.trim();
  if (!t) bad(`${nome} é obrigatório`);
  if (t.length > max) bad(`${nome}: máximo de ${max} caracteres`);
  return t;
};
const validarObjecao = (b) => {
  const gatilhos = Array.isArray(b.gatilhos) ? b.gatilhos.map((g) => String(g).trim()).filter(Boolean) : splitGatilhos(b.gatilhos);
  if (!gatilhos.length) bad('informe ao menos um gatilho');
  if (gatilhos.length > 40 || gatilhos.some((g) => g.length > 120)) bad('gatilhos demais ou muito longos');
  const resposta = textoObrig(b.resposta, 'resposta', 2000);
  const acao = normAcao(b.acao || 'responder');
  if (!acao) bad('ação inválida (responder ou chamar_maria)');
  return { gatilhos, resposta, acao };
};

async function lerLeadPorChat(s, chatid) {
  const { data, error } = await s.from('bot_leads').select('chatid, phone, ghl_contact_id').eq('chatid', chatid).maybeSingle();
  if (error) throw error;
  if (!data) bad('contato não encontrado');
  return data;
}

const ACOES = {
  // ── Config / controle (admin) ──
  save_config: [ADMIN, async (s, b, c) => ({ ...(await gravarConfig(s, b.payload, c.user.email)) })],

  parar_tudo: [ADMIN, async (s, _b, c) => ({ ...(await gravarConfig(s, [{ key: 'bot_enabled', value: 'false' }], c.user.email)), bot_enabled: false })],

  // ── FAQ (admin + operador) ──
  add_faq: [STAFF, async (s, b) => {
    const question = textoObrig(b.question, 'pergunta', 500);
    const answer = textoObrig(b.answer, 'resposta', 3000);
    const { error } = await s.from('bot_faqs').insert([{ question, answer }]);
    if (error) throw error;
  }],
  update_faq: [STAFF, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const question = textoObrig(b.question, 'pergunta', 500);
    const answer = textoObrig(b.answer, 'resposta', 3000);
    const { error } = await s.from('bot_faqs').update({ question, answer }).eq('id', id);
    if (error) throw error;
  }],
  delete_faq: [STAFF, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const { error } = await s.from('bot_faqs').delete().eq('id', id);
    if (error) throw error;
  }],

  rate_conversation: [STAFF, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const rating = b.rating;
    if (rating === null || rating === undefined || (typeof rating !== 'number' && typeof rating !== 'string')) bad('rating inválido');
    const { error } = await s.from('bot_conversations').update({ rating }).eq('id', id);
    if (error) throw error;
  }],

  // ── Objeções (admin + operador) ──
  objecao_salvar: [STAFF, async (s, b) => {
    const v = validarObjecao(b);
    const ativo = b.ativo === undefined ? true : Boolean(b.ativo);
    const ordem = Number.isInteger(b.ordem) ? b.ordem : 0;
    if (b.id) {
      const id = asId(b.id) || bad('id inválido');
      const { error } = await s.from('bot_objections').update({ ...v, ativo, ordem }).eq('id', id);
      if (error) throw error;
    } else {
      const { error } = await s.from('bot_objections').insert([{ ...v, ativo, ordem }]);
      if (error) throw error;
    }
    return { avisos: variaveisDesconhecidas(v.resposta).map((x) => `variável desconhecida: {${x}}`) };
  }],
  objecao_excluir: [STAFF, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const { error } = await s.from('bot_objections').delete().eq('id', id);
    if (error) throw error;
  }],
  // Importação em massa: "gatilhos | resposta | ação". `confirmar:true` grava; senão só valida (prévia).
  objecoes_importar: [STAFF, async (s, b) => {
    const texto = asStr(b.texto);
    if (!texto || !texto.trim()) bad('cole o texto das objeções');
    if (texto.length > 200000) bad('texto grande demais');
    const { itens, erros, avisos } = parseObjecoesTexto(texto);
    const resumo = { total: itens.length, erros, avisos, previa: itens.slice(0, 200).map(({ linha, ...r }) => r) };
    if (b.confirmar !== true) return { ...resumo, gravado: false };
    if (erros.length) bad(`há ${erros.length} linha(s) com erro — corrija antes de importar`);
    if (!itens.length) bad('nenhuma objeção válida no texto');
    // Evita duplicar: pula quem tem o mesmo conjunto de gatilhos já cadastrado.
    const { data: exist, error: e1 } = await s.from('bot_objections').select('gatilhos, ordem');
    if (e1) throw e1;
    const chave = (g) => [...g].map((x) => x.toLowerCase()).sort().join('|');
    const ja = new Set((exist || []).map((o) => chave(o.gatilhos || [])));
    let ordem = Math.max(0, ...(exist || []).map((o) => o.ordem || 0));
    const novas = []; let puladas = 0;
    for (const it of itens) {
      const k = chave(it.gatilhos);
      if (ja.has(k)) { puladas += 1; continue; }
      ja.add(k); ordem += 1;
      novas.push({ gatilhos: it.gatilhos, resposta: it.resposta, acao: it.acao, ativo: true, ordem });
    }
    if (novas.length) {
      const { error } = await s.from('bot_objections').insert(novas);
      if (error) throw error;
    }
    return { ...resumo, gravado: true, inseridas: novas.length, puladas_duplicadas: puladas };
  }],

  // ── Sugestões (aprendizado com a equipe) ──
  sugestao_editar: [STAFF, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const pergunta = textoObrig(b.pergunta, 'pergunta', 1000);
    const resposta_humana = textoObrig(b.resposta_humana, 'resposta', 3000);
    const { error } = await s.from('bot_learning_suggestions').update({ pergunta, resposta_humana }).eq('id', id);
    if (error) throw error;
  }],
  sugestao_converter: [STAFF, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const destino = asStr(b.destino);
    if (destino !== 'faq' && destino !== 'objecao') bad('destino inválido (faq ou objecao)');
    const pergunta = textoObrig(b.pergunta, 'pergunta', 1000);
    const resposta = textoObrig(b.resposta_humana, 'resposta', 3000);
    const { data: sug, error: e0 } = await s.from('bot_learning_suggestions').select('status').eq('id', id).maybeSingle();
    if (e0) throw e0;
    if (!sug) bad('sugestão não encontrada');
    if (sug.status !== 'pendente') bad('esta sugestão já foi tratada');
    if (destino === 'faq') {
      const { error } = await s.from('bot_faqs').insert([{ question: pergunta, answer: resposta }]);
      if (error) throw error;
    } else {
      const v = validarObjecao({ gatilhos: b.gatilhos && b.gatilhos.length ? b.gatilhos : [pergunta], resposta, acao: b.acao });
      const { data: ult } = await s.from('bot_objections').select('ordem').order('ordem', { ascending: false }).limit(1);
      const { error } = await s.from('bot_objections').insert([{ ...v, ativo: true, ordem: (ult?.[0]?.ordem || 0) + 1 }]);
      if (error) throw error;
    }
    const { error } = await s.from('bot_learning_suggestions').update({ pergunta, resposta_humana: resposta, status: destino }).eq('id', id);
    if (error) throw new Error(`criada, mas não consegui marcar a sugestão como tratada: ${error.message}`);
  }],
  sugestao_descartar: [STAFF, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const { error } = await s.from('bot_learning_suggestions').update({ status: 'descartada' }).eq('id', id);
    if (error) throw error;
  }],

  // ── Sombra ──
  sombra_avaliar: [STAFF, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const avaliacao = asStr(b.avaliacao);
    if (!['acertou', 'errou', 'virar_faq'].includes(avaliacao)) bad('avaliação inválida');
    const { data: lin, error: e0 } = await s.from('bot_shadow_log').select('*').eq('id', id).maybeSingle();
    if (e0) throw e0;
    if (!lin) bad('linha não encontrada');
    let sugestao = false;
    if (avaliacao === 'virar_faq') {
      const pergunta = (lin.mensagem_cliente || '').trim();
      const resposta = (lin.resposta_humana || '').trim();
      if (!pergunta || !resposta) bad('só dá para virar FAQ/objeção quando há a mensagem do cliente e a resposta da Maria');
      const { data: ja } = await s.from('bot_learning_suggestions').select('id').eq('chatid', lin.chatid).eq('pergunta', pergunta).eq('status', 'pendente').limit(1);
      if (!ja?.length) {
        const { error } = await s.from('bot_learning_suggestions').insert([{ chatid: lin.chatid, pergunta, resposta_humana: resposta, respondido_por: 'maria' }]);
        if (error) throw error;
        sugestao = true;
      }
    }
    const { error } = await s.from('bot_shadow_log').update({ avaliacao }).eq('id', id);
    if (error) throw error;
    return { sugestao_criada: sugestao };
  }],

  // ── Agenda (admin) ──
  save_calendario: [ADMIN, async (s, b) => {
    const city = textoObrig(b.city, 'cidade', 120);
    const maps_url = validarMapsUrl(b.maps_url);
    const uh = String(b.ultimo_horario ?? '').trim();
    if (uh && !HHMM.test(uh)) bad('último horário deve ser HH:MM');
    const { data, error } = await s.from('bot_calendars').update({ maps_url, ultimo_horario: uh || null }).eq('city', city).select('city');
    if (error) throw error;
    if (!data?.length) bad('cidade não encontrada');
  }],

  save_agenda: [ADMIN, async (s, b) => {
    // Recebe o texto colado no painel, ex.: "Divinópolis 05/12\nDivinópolis 12/12"
    // e grava TODAS as datas de cada cidade (uma cidade tem várias datas no mês).
    const texto = asStr(b.texto);
    if (!texto) bad('texto vazio');
    const { itens, invalidas } = parseAgendaTexto(texto);
    const { data: cals, error: eCals } = await s.from('bot_calendars').select('city, calendar_id');
    if (eCals) throw eCals;
    const porChave = new Map((cals || []).map((c) => [chaveCidade(c.city), c]));
    const naoEncontrados = [];
    const porCidade = new Map(); // city -> Set(datas ISO)
    for (const it of itens) {
      const k = chaveCidade(it.cidade);
      const alvo =
        porChave.get(k) ||
        (cals || []).find((c) => chaveCidade(c.city).includes(k) && k.length >= 4) ||
        (cals || []).find((c) => k.includes(chaveCidade(c.city)) && chaveCidade(c.city).length >= 4);
      if (!alvo) { naoEncontrados.push(it.linha); continue; }
      if (!porCidade.has(alvo.city)) porCidade.set(alvo.city, new Set());
      porCidade.get(alvo.city).add(paraISO(it));
    }
    const hoje = new Date().toISOString().slice(0, 10);
    const aplicados = [];
    for (const [city, setDatas] of porCidade) {
      const datas = [...setDatas].sort();
      const proxima = datas.find((d) => d >= hoje) || datas[datas.length - 1];
      const { error } = await s.from('bot_calendars').update({ attendance_dates: datas, attendance_date: proxima }).eq('city', city);
      if (error) throw error;
      aplicados.push({ city, datas });
    }
    return { aplicados, naoEncontrados, invalidas };
  }],

  // ── Controle por contato (admin + operador; ignorar só admin) ──
  contato_acao: [STAFF, async (s, b, c) => {
    const chatid = asStr(b.chatid) || bad('chatid inválido');
    const acao = asStr(b.acao);
    if (!['pausar', 'retomar', 'ignorar', 'designorar'].includes(acao)) bad('ação inválida');
    const lead = await lerLeadPorChat(s, chatid);
    if (acao === 'pausar') {
      const horas = b.horas === undefined || b.horas === null || b.horas === '' ? null : Number(b.horas);
      if (horas !== null && (!Number.isFinite(horas) || horas <= 0 || horas > 24 * 365)) bad('horas inválidas');
      // Com prazo: só paused_until. Sem prazo ("até retomar"): tag bot-off no GHL.
      if (horas !== null) {
        const paused_until = new Date(Date.now() + horas * 3600000).toISOString();
        const { error } = await s.from('bot_leads').update({ paused_until }).eq('chatid', chatid);
        if (error) throw error;
        return { paused_until };
      }
      const ghl = await sincronizarTags(lead.ghl_contact_id, { adicionar: ['bot-off'], remover: ['bot-ativo'] });
      return { paused_until: null, ghl };
    }
    if (acao === 'retomar') {
      const { error } = await s.from('bot_leads').update({ paused_until: null }).eq('chatid', chatid);
      if (error) throw error;
      const ghl = await sincronizarTags(lead.ghl_contact_id, { adicionar: ['bot-ativo'], remover: ['bot-off'] });
      return { paused_until: null, ghl };
    }
    // ignorar/designorar mexe na lista GLOBAL → só admin.
    if (c.papel !== 'admin') { const e = new Error('Sem permissão'); e.status = 403; throw e; }
    const tel = String(lead.phone || chatid).replace(/\D/g, '');
    if (tel.length < 8) bad('contato sem telefone válido');
    const cfg = await lerConfig(s, ['ignore_numbers']);
    const atual = (cfg.ignore_numbers || '').split(',').map((x) => x.trim()).filter(Boolean);
    const sem = atual.filter((n) => ult8(n) !== ult8(tel));
    const nova = acao === 'ignorar' ? [...sem, tel] : sem;
    await gravarConfig(s, [{ key: 'ignore_numbers', value: nova.join(',') }], c.user.email);
    return { ignorado: acao === 'ignorar' };
  }],

  // ── Instâncias WhatsApp (admin; token só no servidor) ──
  instancia_salvar: [ADMIN, async (s, b, c) => {
    const nome = textoObrig(b.nome, 'nome', 60);
    let base_url;
    try { base_url = validarBaseUrl(b.base_url); } catch (e) { bad(e.message); }
    const token = asStr(b.token)?.trim() || '';
    if (token && (token.length < 8 || token.length > 300 || /\s/.test(token))) bad('token inválido');
    if (b.id) {
      const id = asId(b.id) || bad('id inválido');
      const upd = { nome, base_url };
      if (token) upd.token = token; // vazio = mantém o token atual
      const { error } = await s.from('bot_instances').update(upd).eq('id', id);
      if (error) throw error;
      await s.from('bot_config_audit').insert([{ quem: c.user.email, chave: `instancia:${nome}`, valor_antigo: null, valor_novo: `editada${token ? ' (token trocado)' : ''}` }]);
    } else {
      if (!token) bad('informe o token da instância');
      const { error } = await s.from('bot_instances').insert([{ nome, base_url, token, ativa: false, principal: false }]);
      if (error) throw error;
      await s.from('bot_config_audit').insert([{ quem: c.user.email, chave: `instancia:${nome}`, valor_antigo: null, valor_novo: 'criada' }]);
    }
  }],
  // Escolhe a instância usada pelo bot. NÃO reconfigura o webhook (isso é manual).
  instancia_ativar: [ADMIN, async (s, b, c) => {
    const id = asId(b.id) || bad('id inválido');
    const { data: alvo, error: e0 } = await s.from('bot_instances').select('id, nome').eq('id', id).maybeSingle();
    if (e0) throw e0;
    if (!alvo) bad('instância não encontrada');
    const { error: e1 } = await s.from('bot_instances').update({ ativa: true }).eq('id', id);
    if (e1) throw e1;
    const { error: e2 } = await s.from('bot_instances').update({ ativa: false }).neq('id', id);
    if (e2) throw new Error(`ativada, mas não consegui desativar as outras: ${e2.message}`);
    await s.from('bot_config_audit').insert([{ quem: c.user.email, chave: 'instancia_ativa', valor_antigo: null, valor_novo: alvo.nome }]);
  }],
  instancia_principal: [ADMIN, async (s, b, c) => {
    const id = asId(b.id) || bad('id inválido');
    const { data: alvo } = await s.from('bot_instances').select('id, nome').eq('id', id).maybeSingle();
    if (!alvo) bad('instância não encontrada');
    const { error: e1 } = await s.from('bot_instances').update({ principal: true }).eq('id', id);
    if (e1) throw e1;
    const { error: e2 } = await s.from('bot_instances').update({ principal: false }).neq('id', id);
    if (e2) throw e2;
    await s.from('bot_config_audit').insert([{ quem: c.user.email, chave: 'instancia_principal', valor_antigo: null, valor_novo: alvo.nome }]);
  }],
  instancia_excluir: [ADMIN, async (s, b, c) => {
    const id = asId(b.id) || bad('id inválido');
    const { data: alvo } = await s.from('bot_instances').select('id, nome, ativa').eq('id', id).maybeSingle();
    if (!alvo) bad('instância não encontrada');
    if (alvo.ativa) bad('não dá para excluir a instância ativa — ative outra antes');
    const { error } = await s.from('bot_instances').delete().eq('id', id);
    if (error) throw error;
    await s.from('bot_config_audit').insert([{ quem: c.user.email, chave: `instancia:${alvo.nome}`, valor_antigo: null, valor_novo: 'excluída' }]);
  }],
  // GET {base_url}/instance/status com header `token` e User-Agent de navegador.
  instancia_testar: [ADMIN, async (s, b) => {
    const id = asId(b.id) || bad('id inválido');
    const { data: inst, error } = await s.from('bot_instances').select('base_url, token').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!inst) bad('instância não encontrada');
    const t0 = Date.now();
    try {
      const base = validarBaseUrl(inst.base_url);
      await garantirHostPublico(base);
      const res = await fetch(`${base}/instance/status`, {
        method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(10000),
        headers: { token: inst.token, Accept: 'application/json', 'User-Agent': UA_NAVEGADOR },
      });
      const txt = (await res.text()).slice(0, 4000);
      let corpo = null;
      try { corpo = JSON.parse(txt); } catch { corpo = null; }
      const resumo = corpo ? higienizar(corpo, inst.token) : higienizar(txt.slice(0, 300), inst.token);
      return { teste: { ok: res.ok, http: res.status, ms: Date.now() - t0, resposta: typeof resumo === 'string' ? resumo : JSON.stringify(resumo).slice(0, 1500) } };
    } catch (e) {
      return { teste: { ok: false, http: null, ms: Date.now() - t0, erro: higienizar(e.name === 'TimeoutError' ? 'tempo esgotado (10 s)' : e.message, inst.token) } };
    }
  }],

  // ── Simulador dry-run (admin): usa o MESMO caminho do bot real, sem enviar nem gravar ──
  simular: [ADMIN, async (_s, b) => {
    const phone = String(b.phone || '').replace(/\D/g, '');
    if (phone.length < 10 || phone.length > 15) bad('telefone inválido (DDI+DDD+número)');
    const message = textoObrig(b.message, 'mensagem', 2000);
    const secret = process.env.BOT_TEST_SECRET;
    if (!secret) { const e = new Error('BOT_TEST_SECRET não configurado no servidor do painel'); e.status = 503; throw e; }
    const url = process.env.BOT_TEST_URL || 'https://bot.volanteexpress.com.br/api/bot/test';
    const res = await fetch(url, {
      method: 'POST', signal: AbortSignal.timeout(90000),
      headers: { 'Content-Type': 'application/json', 'x-bot-test-secret': secret },
      body: JSON.stringify({ phone, message, dry_run: true, dryRun: true }),
    });
    const txt = await res.text();
    let corpo; try { corpo = JSON.parse(txt); } catch { corpo = { raw: txt.slice(0, 500) }; }
    if (!res.ok) { const e = new Error(corpo?.error || `bot respondeu HTTP ${res.status}`); e.status = 502; throw e; }
    return { resultado: higienizar(corpo, secret) };
  }],
};

export async function POST(req) {
  try {
    const body = await req.json();
    const def = ACOES[body?.action];
    if (!def) return json({ error: 'action inválida' }, 400);
    const ctx = await requirePapel(req, def[0]);
    const extra = await def[1](botServiceClient(), body, ctx);
    return json({ ok: true, ...(extra || {}) });
  } catch (e) {
    return json({ error: e.message }, e instanceof Invalido ? 400 : e.status || 500);
  }
}
