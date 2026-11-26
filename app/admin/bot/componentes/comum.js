'use client';
// app/admin/bot/componentes/comum.js
// Cliente da API /api/admin/bot (toda a lógica sensível roda no servidor) + átomos de UI.
import { useMemo, useCallback, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

async function lerJson(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch { throw new Error(res.ok ? 'Resposta inválida do servidor' : `HTTP ${res.status}`); }
}

export function useBotApi() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ), []);

  const cabecalho = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); throw new Error('Sessão expirada'); }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [supabase, router]);

  // Lança Error em falha (a tela decide como avisar). Nunca devolve [] em erro.
  const get = useCallback(async (recurso, params = {}) => {
    const qs = new URLSearchParams({ recurso, ...params }).toString();
    const res = await fetch(`/api/admin/bot?${qs}`, { headers: await cabecalho(), cache: 'no-store' });
    const j = await lerJson(res);
    if (!res.ok) throw new Error(j.error || 'Erro ao carregar');
    return j.data;
  }, [cabecalho]);

  const post = useCallback(async (payload) => {
    const res = await fetch('/api/admin/bot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await cabecalho()) },
      body: JSON.stringify(payload),
    });
    const j = await lerJson(res);
    if (!res.ok) throw new Error(j.error || 'Erro');
    return j;
  }, [cabecalho]);

  return useMemo(() => ({ get, post, supabase }), [get, post, supabase]);
}

// Carrega dados ao montar/quando `fn` muda. A chamada é assíncrona (microtask) para não
// disparar setState síncrono dentro do efeito.
export function useAoMontar(fn) {
  useEffect(() => {
    let vivo = true;
    Promise.resolve().then(() => { if (vivo) fn(); });
    return () => { vivo = false; };
  }, [fn]);
}

export const fmtData = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
};

// Máscara de telefone só para exibição.
export const fmtFone = (s) => String(s || '').replace(/@.*$/, '').replace(/\D/g, '');

export const cx = (...a) => a.filter(Boolean).join(' ');

export const inputCls = 'w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-blue-500';
export const btnAzul = 'bg-blue-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
export const btnCinza = 'bg-slate-100 text-slate-700 font-bold py-2 px-4 rounded-xl text-sm hover:bg-slate-200 transition-colors disabled:opacity-50';
export const cartao = 'bg-white rounded-2xl shadow-sm border border-gray-100 p-5';

export function Aviso({ tipo = 'info', children }) {
  const cores = {
    info: 'bg-blue-50 border-blue-100 text-blue-800',
    alerta: 'bg-amber-50 border-amber-200 text-amber-800',
    erro: 'bg-red-50 border-red-200 text-red-700',
    ok: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  return <div className={cx('border rounded-xl px-4 py-3 text-sm', cores[tipo])}>{children}</div>;
}

export function Campo({ rotulo, dica, children }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-bold text-slate-700">{rotulo}</label>
      {dica && <p className="text-xs text-slate-500">{dica}</p>}
      {children}
    </div>
  );
}

// Mapa {chave: valor} a partir da lista de bot_config.
export const configParaMapa = (lista) => Object.fromEntries((Array.isArray(lista) ? lista : []).map((r) => [r.key, r.value]));
