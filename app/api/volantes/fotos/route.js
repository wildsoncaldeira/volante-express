// app/api/volantes/fotos/route.js
// Lista as fotos de volantes (Supabase do bot) por ordem de prioridade.
// Roda no SERVIDOR — a service_role NUNCA vai para o cliente.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calcularPrioridade } from '../../utils/volantesData';

export const dynamic = 'force-dynamic';

function botClient() {
  const url = process.env.SUPABASE_BOT_URL;
  const key = process.env.SUPABASE_BOT_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Defina SUPABASE_BOT_URL e SUPABASE_BOT_SERVICE_KEY no servidor (.env).');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET() {
  try {
    const supabase = botClient();
    const { data, error } = await supabase
      .from('volantes_fotos')
      .select('id,marca,modelo,modelo_slug,url')
      .order('marca', { ascending: true })
      .order('modelo_slug', { ascending: true })
      .limit(5000);
    if (error) throw error;

    const fotos = (data || [])
      .map((f) => ({ ...f, _prio: calcularPrioridade(f) }))
      .sort((a, b) => b._prio - a._prio);

    return NextResponse.json({ fotos, total: fotos.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
