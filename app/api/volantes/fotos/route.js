// app/api/volantes/fotos/route.js
// Lista as fotos de volantes (Supabase do bot) por ordem de prioridade.
// Roda no SERVIDOR — a service_role NUNCA vai para o cliente. Exige usuário autenticado.
import { NextResponse } from 'next/server';
import { calcularPrioridade } from '../../../utils/volantesData';
import { botServiceClient, requireUser } from '../../../utils/botSupabase';

export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };

export async function GET(req) {
  try {
    await requireUser(req);
    const supabase = botServiceClient();
    const { data, error } = await supabase
      .from('volantes_fotos')
      .select('id,marca,modelo,modelo_slug,url')
      .order('marca', { ascending: true })
      .order('modelo_slug', { ascending: true })
      .limit(5000); // hoje ~374 linhas; limite alto só como trava de segurança
    if (error) throw error;

    const fotos = (data || [])
      .map((f) => ({ ...f, _prio: calcularPrioridade(f) }))
      .sort((a, b) => b._prio - a._prio);

    return NextResponse.json({ fotos, total: fotos.length }, { headers: noStore });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: e.status || 500, headers: noStore });
  }
}