// app/api/volantes/compatibilidade/route.js
// Lê e grava as associações modelo-do-cliente -> foto (tabela volantes_compatibilidade).
// Roda no SERVIDOR — sem chave no cliente.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function botClient() {
  const url = process.env.SUPABASE_BOT_URL;
  const key = process.env.SUPABASE_BOT_SERVICE_KEY;
  if (!url || !key) {
    throw new Error('Defina SUPABASE_BOT_URL e SUPABASE_BOT_SERVICE_KEY no servidor (.env).');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET — todas as associações, agrupadas por foto_id
export async function GET() {
  try {
    const supabase = botClient();
    const { data, error } = await supabase
      .from('volantes_compatibilidade')
      .select('id,modelo_cliente,marca_foto,foto_id,modelo_slug_busca,ano_min,ano_max')
      .order('foto_id', { ascending: true })
      .limit(20000);
    if (error) throw error;

    const porFoto = {};
    for (const r of data || []) {
      (porFoto[r.foto_id] ||= []).push(r);
    }
    return NextResponse.json({ itens: data || [], porFoto });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST — salva (substitui) as associações de uma foto
// body: { foto_id, foto_slug, marca_foto, modelos: [{modelo, marca, anoMin, anoMax}] }
export async function POST(req) {
  try {
    const supabase = botClient();
    const { foto_id, foto_slug, marca_foto, modelos } = await req.json();

    if (!foto_id || !Array.isArray(modelos)) {
      return NextResponse.json({ error: 'foto_id e modelos[] são obrigatórios.' }, { status: 400 });
    }

    // Substitui o conjunto inteiro daquela foto (idempotente).
    const { error: delErr } = await supabase
      .from('volantes_compatibilidade')
      .delete()
      .eq('foto_id', foto_id);
    if (delErr) throw delErr;

    const rows = modelos
      .filter((m) => m && m.modelo && m.modelo.toUpperCase() !== 'IGNORAR')
      .map((m) => ({
        modelo_cliente: m.modelo,
        marca_foto: m.marca || marca_foto || '',
        foto_id,
        modelo_slug_busca: foto_slug || '',
        ano_min: m.anoMin ?? null,
        ano_max: m.anoMax ?? null,
      }));

    if (rows.length) {
      const { error: insErr } = await supabase.from('volantes_compatibilidade').insert(rows);
      if (insErr) throw insErr;
    }

    return NextResponse.json({ ok: true, salvos: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
