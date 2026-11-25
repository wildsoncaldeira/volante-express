// app/api/admin/bot/route.js
// Leituras e escritas do painel do bot (bot_config / bot_faqs / bot_regionais /
// bot_conversations) feitas NO SERVIDOR — o navegador nunca vê a chave do Supabase.
// Exige ADMIN (allowlist ADMIN_EMAILS obrigatória) e valida toda entrada.
import { NextResponse } from 'next/server';
import { botServiceClient, requireAdmin } from '../../../utils/botSupabase';
import { parseAgendaTexto, paraISO, normCidade } from '../../../utils/agendaTexto';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };

const tabelaPorRecurso = {
  config: 'bot_config',
  faqs: 'bot_faqs',
  regionais: 'bot_regionais',
  conversas: 'bot_conversations',
  calendarios: 'bot_calendars',
};

// Só estas chaves de bot_config podem ser gravadas pelo painel.
const CHAVES_CONFIG = new Set(['photo_caption', 'scarcity_text', 'info_text', 'closing_text']);

const asStr = (v) => (typeof v === 'string' ? v : null);
const asId = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const bad = (msg) => NextResponse.json({ error: msg }, { status: 400, headers: noStore });

// GET /api/admin/bot?recurso=config|faqs|regionais|conversas
export async function GET(req) {
  try {
    await requireAdmin(req);
    const recurso = new URL(req.url).searchParams.get('recurso') || 'config';
    const tabela = tabelaPorRecurso[recurso];
    if (!tabela) return bad('recurso inválido');

    const supabase = botServiceClient();
    let q = supabase.from(tabela).select('*');
    if (recurso === 'faqs') q = q.order('created_at', { ascending: true });
    if (recurso === 'regionais') q = q.order('region', { ascending: true });
    if (recurso === 'calendarios') q = q.order('city', { ascending: true });
    if (recurso === 'conversas') q = q.order('created_at', { ascending: false }).limit(200);
    const { data, error } = await q;
    if (error) throw error;
    return NextResponse.json({ data: data || [] }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500, headers: noStore });
  }
}

// POST /api/admin/bot  { action, ... }
export async function POST(req) {
  try {
    await requireAdmin(req);
    const body = await req.json();
    const supabase = botServiceClient();
    const { action } = body;

    switch (action) {
      case 'save_config': {
        const payload = Array.isArray(body.payload) ? body.payload : null;
        if (!payload || !payload.length) return bad('payload inválido');
        const linhas = [];
        for (const item of payload) {
          const key = asStr(item?.key);
          const value = asStr(item?.value);
          if (!key || value === null) return bad('item de config inválido');
          if (!CHAVES_CONFIG.has(key)) return bad(`chave não permitida: ${key}`);
          linhas.push({ key, value });
        }
        const { error } = await supabase.from('bot_config').upsert(linhas, { onConflict: 'key' });
        if (error) throw error;
        break;
      }
      case 'add_faq': {
        const question = asStr(body.question)?.trim();
        const answer = asStr(body.answer)?.trim();
        if (!question || !answer) return bad('pergunta e resposta são obrigatórias');
        const { error } = await supabase.from('bot_faqs').insert([{ question, answer }]);
        if (error) throw error;
        break;
      }
      case 'delete_faq': {
        const id = asId(body.id);
        if (!id) return bad('id inválido');
        const { error } = await supabase.from('bot_faqs').delete().eq('id', id);
        if (error) throw error;
        break;
      }
      case 'add_regional': {
        const city = asStr(body.city)?.trim();
        const attendance_date = asStr(body.attendanceDate)?.trim();
        const region = asStr(body.region)?.trim();
        if (!city || !attendance_date || !region) return bad('cidade, data e regional são obrigatórias');
        const { error } = await supabase.from('bot_regionais').insert([{ city, attendance_date, region }]);
        if (error) throw error;
        break;
      }
      case 'delete_regional': {
        const id = asId(body.id);
        if (!id) return bad('id inválido');
        const { error } = await supabase.from('bot_regionais').delete().eq('id', id);
        if (error) throw error;
        break;
      }
      case 'rate_conversation': {
        const id = asId(body.id);
        if (!id) return bad('id inválido');
        const rating = body.rating;
        if (rating === null || rating === undefined || (typeof rating !== 'number' && typeof rating !== 'string')) {
          return bad('rating inválido');
        }
        const { error } = await supabase.from('bot_conversations').update({ rating }).eq('id', id);
        if (error) throw error;
        break;
      }
      case 'save_agenda': {
        // Recebe o texto colado no painel, ex.: "Divinópolis 27/11\nSete Lagoas 26/11"
        const texto = asStr(body.texto);
        if (!texto) return bad('texto vazio');
        const { itens, invalidas } = parseAgendaTexto(texto);
        const { data: cals, error: eCals } = await supabase.from('bot_calendars').select('city, calendar_id');
        if (eCals) throw eCals;
        const porNorm = new Map((cals || []).map((c) => [normCidade(c.city), c]));
        const aplicados = [];
        const naoEncontrados = [];
        for (const it of itens) {
          const alvo = porNorm.get(normCidade(it.cidade));
          if (!alvo) { naoEncontrados.push(it.linha); continue; }
          const iso = paraISO(it);
          const { error } = await supabase
            .from('bot_calendars')
            .update({ attendance_date: iso })
            .eq('city', alvo.city);
          if (error) throw error;
          aplicados.push({ city: alvo.city, date: iso });
        }
        return NextResponse.json({ ok: true, aplicados, naoEncontrados, invalidas }, { headers: noStore });
      }
      default:
        return bad('action inválida');
    }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500, headers: noStore });
  }
}