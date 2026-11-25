// app/api/admin/bot/route.js
// Leituras e escritas do painel do bot (bot_config / bot_faqs / bot_regionais /
// bot_conversations) feitas NO SERVIDOR — o navegador nunca vê a chave do Supabase.
import { NextResponse } from 'next/server';
import { botServiceClient, requireUser } from '../../../utils/botSupabase';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };
const tabelaPorRecurso = {
  config: 'bot_config',
  faqs: 'bot_faqs',
  regionais: 'bot_regionais',
  conversas: 'bot_conversations',
};

// GET /api/admin/bot?recurso=config|faqs|regionais|conversas
export async function GET(req) {
  try {
    await requireUser(req);
    const recurso = new URL(req.url).searchParams.get('recurso') || 'config';
    const tabela = tabelaPorRecurso[recurso];
    if (!tabela) return NextResponse.json({ error: 'recurso inválido' }, { status: 400, headers: noStore });

    const supabase = botServiceClient();
    let q = supabase.from(tabela).select('*');
    if (recurso === 'faqs') q = q.order('created_at', { ascending: true });
    if (recurso === 'regionais') q = q.order('region', { ascending: true });
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
    await requireUser(req);
    const body = await req.json();
    const supabase = botServiceClient();
    const { action } = body;

    switch (action) {
      case 'save_config': {
        const payload = Array.isArray(body.payload) ? body.payload : [];
        const { error } = await supabase.from('bot_config').upsert(payload, { onConflict: 'key' });
        if (error) throw error;
        break;
      }
      case 'add_faq': {
        const { error } = await supabase.from('bot_faqs').insert([{ question: body.question, answer: body.answer }]);
        if (error) throw error;
        break;
      }
      case 'delete_faq': {
        const { error } = await supabase.from('bot_faqs').delete().eq('id', body.id);
        if (error) throw error;
        break;
      }
      case 'add_regional': {
        const { error } = await supabase.from('bot_regionais').insert([{
          city: body.city, attendance_date: body.attendanceDate, region: body.region,
        }]);
        if (error) throw error;
        break;
      }
      case 'delete_regional': {
        const { error } = await supabase.from('bot_regionais').delete().eq('id', body.id);
        if (error) throw error;
        break;
      }
      case 'rate_conversation': {
        const { error } = await supabase.from('bot_conversations').update({ rating: body.rating }).eq('id', body.id);
        if (error) throw error;
        break;
      }
      default:
        return NextResponse.json({ error: 'action inválida' }, { status: 400, headers: noStore });
    }
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500, headers: noStore });
  }
}