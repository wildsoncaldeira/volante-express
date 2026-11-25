// app/api/volantes/compatibilidade/route.js
// Lê e grava as associações modelo-do-cliente -> foto (volantes_compatibilidade).
// Server-side, com autenticação. Gravação "insert-first": insere o novo conjunto
// ANTES de apagar o antigo — se o insert falhar, nada é perdido.
import { NextResponse } from 'next/server';
import { botServiceClient, requireUser, IGNORAR } from '../../../utils/botSupabase';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };

// GET — associações agrupadas por foto_id (+ lista de fotos marcadas como ignoradas)
export async function GET(req) {
  try {
    await requireUser(req);
    const supabase = botServiceClient();
    const { data, error } = await supabase
      .from('volantes_compatibilidade')
      .select('id,modelo_cliente,marca_foto,foto_id,modelo_slug_busca,ano_min,ano_max')
      .order('foto_id', { ascending: true })
      .limit(20000); // folga; a tabela cresce pouco
    if (error) throw error;

    const porFoto = {};
    const ignoradas = [];
    for (const r of data || []) {
      if (r.modelo_cliente === IGNORAR) { ignoradas.push(r.foto_id); continue; }
      (porFoto[r.foto_id] ||= []).push(r);
    }
    return NextResponse.json({ itens: data || [], porFoto, ignoradas }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500, headers: noStore });
  }
}

// POST — salva (substitui) as associações de uma foto, atomicamente.
// body: { foto_id, foto_slug, marca_foto, modelos: [{modelo, marca, anoMin, anoMax}] }
// Se `modelos` vier como [{modelo:'IGNORAR'}], grava a sentinela "irrelevante".
export async function POST(req) {
  try {
    await requireUser(req);
    const supabase = botServiceClient();
    const { foto_id, foto_slug, marca_foto, modelos } = await req.json();

    if (!foto_id || !Array.isArray(modelos)) {
      return NextResponse.json({ error: 'foto_id e modelos[] são obrigatórios.' }, { status: 400, headers: noStore });
    }

    const ignorar = modelos.length > 0 && modelos.every((m) => (m?.modelo || '').toUpperCase() === 'IGNORAR');

    const rows = ignorar
      ? [{ modelo_cliente: IGNORAR, marca_foto: '', foto_id, modelo_slug_busca: foto_slug || '', ano_min: null, ano_max: null }]
      : modelos
          .filter((m) => m && m.modelo && m.modelo.toUpperCase() !== 'IGNORAR')
          .map((m) => ({
            modelo_cliente: m.modelo,
            marca_foto: m.marca || marca_foto || '',
            foto_id,
            modelo_slug_busca: foto_slug || '',
            ano_min: m.anoMin ?? null,
            ano_max: m.anoMax ?? null,
          }));

    if (!rows.length) {
      return NextResponse.json({ error: 'Nenhum modelo válido para salvar.' }, { status: 400, headers: noStore });
    }

    // 1) insere o novo conjunto primeiro
    const { data: inserted, error: insErr } = await supabase
      .from('volantes_compatibilidade')
      .insert(rows)
      .select('id');
    if (insErr) throw insErr;

    // 2) só então apaga as linhas antigas que NÃO fazem parte do novo conjunto
    const novosIds = (inserted || []).map((r) => r.id);
    if (novosIds.length) {
      const { error: delErr } = await supabase
        .from('volantes_compatibilidade')
        .delete()
        .eq('foto_id', foto_id)
        .not('id', 'in', `(${novosIds.join(',')})`);
      if (delErr) {
        // Novo conjunto já está salvo; só a limpeza do antigo falhou. Salvar de novo resolve.
        return NextResponse.json(
          { error: 'Salvo, mas não consegui limpar as associações antigas. Clique em salvar de novo.' },
          { status: 500, headers: noStore });
      }
    }

    return NextResponse.json({ ok: true, salvos: rows.length, ignorada: ignorar }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500, headers: noStore });
  }
}