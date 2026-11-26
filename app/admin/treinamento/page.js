'use client';
// app/admin/treinamento/page.js
// Tela de Treinamento de Fotos — reconstrução da ferramenta HTML, server-side.
// Nenhuma chave do Supabase no cliente: usa o token de sessão + /api/volantes/*.
//
// Fila (item 19): primeiro as PENDENTES (sem associação e não ignoradas), na ordem de
// prioridade que a API devolve; depois as treinadas; as ignoradas por último. Ao salvar,
// a foto vai para o grupo das treinadas e a próxima pendente aparece no lugar — sem voltar
// ao começo. Abas por montadora com progresso, filtro de status e contadores.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { MODELOS, badgePrioridade } from '../../utils/volantesData';

// Lê JSON tratando resposta não-JSON (HTML de erro do Next, 404, etc.)
async function lerJson(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); }
  catch { throw new Error(res.ok ? 'Resposta inválida do servidor' : `HTTP ${res.status}`); }
}

const CHAVE_ABA = 've_treinamento_aba';
const lerAbaSalva = () => {
  try { return window.localStorage.getItem(CHAVE_ABA) || 'todas'; } catch { return 'todas'; }
};
const salvarAba = (v) => {
  try { window.localStorage.setItem(CHAVE_ABA, v); } catch { /* storage bloqueado: segue sem lembrar */ }
};

const FILTROS = [['pendentes', 'Pendentes'], ['treinadas', 'Treinadas'], ['ignoradas', 'Ignoradas'], ['todas', 'Todas']];
const nomeMarca = (m) => (m ? m.charAt(0) + m.slice(1).toLowerCase() : '(sem marca)');
const ORDEM_STATUS = { pendente: 0, treinada: 1, ignorada: 2 };

export default function TreinamentoVolantes() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ), []);
  const [fotos, setFotos] = useState([]);
  const [aba, setAba] = useState(lerAbaSalva);          // marca escolhida ('todas' = todas)
  const [filtro, setFiltro] = useState('pendentes');     // pendentes | treinadas | ignoradas | todas
  const [atualId, setAtualId] = useState(null);          // foto em exibição (null = primeira da fila)
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [modelos, setModelos] = useState([]);
  const [busca, setBusca] = useState('');
  const [sugAberta, setSugAberta] = useState(false);
  const [anoMin, setAnoMin] = useState('');
  const [anoMax, setAnoMax] = useState('');
  const [assoc, setAssoc] = useState({});
  const [ignoradas, setIgnoradas] = useState([]);
  const [copiarId, setCopiarId] = useState('');
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const buscaRef = useRef(null);
  const timer = useRef(null);

  // Headers com o token ATUAL: getSession() renova o access_token (~1h) sozinho,
  // então sessões longas de treinamento não caem em "Sessão inválida".
  const authHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/login'); throw new Error('Sessão expirada. Faça login novamente.'); }
    return { Authorization: `Bearer ${session.access_token}` };
  }, [supabase, router]);

  // ── sessão + carga inicial ──
  useEffect(() => {
    (async () => {
      try {
        const h = await authHeaders();
        const [rf, rc] = await Promise.all([
          fetch('/api/volantes/fotos', { headers: h }),
          fetch('/api/volantes/compatibilidade', { headers: h }),
        ]);
        const df = await lerJson(rf);
        const dc = await lerJson(rc);
        if (!rf.ok) throw new Error(df.error || 'Erro ao carregar fotos');
        if (!rc.ok) throw new Error(dc.error || 'Erro ao carregar associações');
        setFotos(df.fotos || []);
        setIgnoradas(dc.ignoradas || []);
        const map = {};
        for (const [fid, linhas] of Object.entries(dc.porFoto || {})) {
          map[fid] = linhas.map((r) => ({ modelo: r.modelo_cliente, marca: r.marca_foto, anoMin: r.ano_min, anoMax: r.ano_max }));
        }
        setAssoc(map);
      } catch (e) { setErro(e.message); }
      finally { setCarregando(false); }
    })();
    return () => clearTimeout(timer.current);
  }, [authHeaders]);

  // Status de cada foto, derivado de `assoc` e `ignoradas` (a tela já carrega os dois).
  const statusDe = useCallback((f) => {
    if (ignoradas.includes(f.id)) return 'ignorada';
    return assoc[f.id]?.length ? 'treinada' : 'pendente';
  }, [assoc, ignoradas]);

  // Marcas + progresso (feitas = treinadas + ignoradas; total = todas as fotos da marca).
  const marcas = useMemo(() => {
    const m = new Map();
    for (const f of fotos) {
      const k = f.marca || '';
      const e = m.get(k) || { marca: k, total: 0, pendentes: 0, treinadas: 0, ignoradas: 0 };
      e.total += 1;
      const s = statusDe(f);
      if (s === 'pendente') e.pendentes += 1; else if (s === 'treinada') e.treinadas += 1; else e.ignoradas += 1;
      m.set(k, e);
    }
    return [...m.values()].sort((a, b) => nomeMarca(a.marca).localeCompare(nomeMarca(b.marca)));
  }, [fotos, statusDe]);

  const abaValida = aba === 'todas' || marcas.some((m) => m.marca === aba) ? aba : 'todas';

  const contadores = useMemo(() => {
    const base = abaValida === 'todas'
      ? marcas.reduce((a, m) => ({ total: a.total + m.total, pendentes: a.pendentes + m.pendentes, treinadas: a.treinadas + m.treinadas, ignoradas: a.ignoradas + m.ignoradas }), { total: 0, pendentes: 0, treinadas: 0, ignoradas: 0 })
      : marcas.find((m) => m.marca === abaValida) || { total: 0, pendentes: 0, treinadas: 0, ignoradas: 0 };
    return base;
  }, [marcas, abaValida]);

  // Fila: filtra por marca e status e ordena pendentes → treinadas → ignoradas.
  // `Array.sort` é estável, então dentro de cada grupo vale a prioridade da API.
  const fila = useMemo(() => {
    const alvo = { pendentes: 'pendente', treinadas: 'treinada', ignoradas: 'ignorada' }[filtro];
    return fotos
      .filter((f) => (abaValida === 'todas' || f.marca === abaValida))
      .map((f) => ({ f, s: statusDe(f) }))
      .filter(({ s }) => !alvo || s === alvo)
      .sort((a, b) => ORDEM_STATUS[a.s] - ORDEM_STATUS[b.s])
      .map(({ f }) => f);
  }, [fotos, abaValida, filtro, statusDe]);

  const porId = useMemo(() => new Map(fotos.map((f) => [f.id, f])), [fotos]);
  const foto = (atualId != null && porId.get(atualId)) || fila[0];
  const indice = foto ? fila.findIndex((f) => f.id === foto.id) : -1;
  const estaIgnorada = foto ? ignoradas.includes(foto.id) : false;

  // Pré-carrega os modelos da foto (depois da carga e a cada troca de foto)
  useEffect(() => {
    if (carregando) return;
    setModelos(foto && assoc[foto.id] ? assoc[foto.id].map((m) => ({ ...m })) : []);
    setBusca(''); setAnoMin(''); setAnoMax(''); setCopiarId(''); setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foto?.id, carregando]);

  const sugestoes = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return [];
    return MODELOS.filter((m) => m.m.toLowerCase().includes(q)).slice(0, 10);
  }, [busca]);

  const adicionar = useCallback((modelo, marca) => {
    const nome = modelo || busca.trim();
    if (!nome) return;
    setModelos((prev) => [...prev, {
      modelo: nome, marca: marca || foto?.marca || '',
      anoMin: parseInt(anoMin) || null, anoMax: parseInt(anoMax) || null,
    }]);
    setBusca(''); setAnoMin(''); setAnoMax(''); setSugAberta(false); buscaRef.current?.focus();
  }, [busca, anoMin, anoMax, foto]);

  const escolherAba = (v) => { setAba(v); salvarAba(v); setAtualId(null); setFiltro('pendentes'); };
  const escolherFiltro = (v) => { setFiltro(v); setAtualId(null); };

  // Pular: vai para a próxima da fila; no fim, volta à primeira (e avisa).
  const proxima = useCallback(() => {
    clearTimeout(timer.current);
    if (!fila.length) return;
    const prox = fila[indice + 1];
    if (prox) setAtualId(prox.id);
    else { setAtualId(fila[0].id); setMsg({ t: 'ok', m: 'Fim da fila: voltando à primeira desta lista' }); }
  }, [fila, indice]);

  async function salvar(linhas, avancar = true) {
    if (!foto) return;
    if (!linhas.length) { setMsg({ t: 'err', m: 'Adicione pelo menos um modelo.' }); return; }
    setSalvando(true); setMsg(null);
    // A "próxima" é definida ANTES de atualizar o status: a foto salva sai da posição atual
    // (vai para o grupo das treinadas) e a seguinte da fila ocupa o lugar.
    const proximaId = fila[indice + 1]?.id ?? fila.find((f) => f.id !== foto.id)?.id ?? null;
    try {
      const res = await fetch('/api/volantes/compatibilidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ foto_id: foto.id, foto_slug: foto.modelo_slug, marca_foto: foto.marca, modelos: linhas }),
      });
      const d = await lerJson(res);
      if (!res.ok) throw new Error(d.error || 'Erro ao salvar');

      if (d.ignorada) {
        setIgnoradas((prev) => (prev.includes(foto.id) ? prev : [...prev, foto.id]));
        setAssoc((prev) => { const c = { ...prev }; delete c[foto.id]; return c; });
        setMsg({ t: 'ok', m: 'Marcada como irrelevante' });
      } else {
        setAssoc((prev) => ({ ...prev, [foto.id]: linhas }));
        setIgnoradas((prev) => prev.filter((id) => id !== foto.id));
        setMsg({ t: 'ok', m: `Salvo (${d.salvos})` });
      }
      if (avancar) { clearTimeout(timer.current); timer.current = setTimeout(() => setAtualId(proximaId), 350); }
    } catch (e) { setMsg({ t: 'err', m: e.message }); }
    finally { setSalvando(false); }
  }

  const aplicarCopia = () => {
    const id = copiarId.trim().replace('#', '');
    const achado = Object.entries(assoc).find(([fid]) => String(fid) === id);
    if (!achado) { setMsg({ t: 'err', m: 'ID não encontrado' }); return; }
    setModelos(achado[1].map((m) => ({ ...m })));
    setMsg({ t: 'ok', m: `${achado[1].length} modelo(s) copiado(s)` });
  };

  if (carregando) return <div className="p-10 text-slate-400">Carregando fotos…</div>;
  if (erro) return <div className="p-10 text-red-500">Erro: {erro}</div>;

  const cabecalho = (
    <header className="bg-[#1a3270] border-b border-slate-700 px-6 py-3 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-[15px] font-semibold">🎯 Treinamento de Fotos — Volante Express</h1>
        <span className="text-xs text-slate-300 bg-white/10 px-3 py-1 rounded-full">
          pendentes {contadores.pendentes} · treinadas {contadores.treinadas} · ignoradas {contadores.ignoradas}
        </span>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[{ marca: 'todas', total: fotos.length, feitas: contadores.total ? marcas.reduce((a, m) => a + m.treinadas + m.ignoradas, 0) : 0 }, ...marcas.map((m) => ({ marca: m.marca, total: m.total, feitas: m.treinadas + m.ignoradas }))].map((t) => (
          <button key={t.marca || 'sem'} onClick={() => escolherAba(t.marca)}
            className={`whitespace-nowrap text-xs rounded-full px-3 py-1 border ${abaValida === t.marca ? 'bg-white text-[#1a3270] border-white font-bold' : 'border-slate-500 text-slate-200 hover:bg-white/10'}`}>
            {t.marca === 'todas' ? 'Todas' : nomeMarca(t.marca)} {t.feitas}/{t.total}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {FILTROS.map(([v, r]) => (
          <button key={v} onClick={() => escolherFiltro(v)}
            className={`text-xs rounded-md px-3 py-1 border ${filtro === v ? 'bg-emerald-500 text-black border-emerald-500 font-bold' : 'border-slate-500 text-slate-300 hover:bg-white/10'}`}>{r}</button>
        ))}
        {foto && <span className="ml-auto text-xs text-slate-400">{indice + 1} / {fila.length} nesta lista</span>}
      </div>
    </header>
  );

  if (!foto) {
    const proximaMarca = [...marcas].filter((m) => m.pendentes > 0 && m.marca !== abaValida).sort((a, b) => b.pendentes - a.pendentes)[0];
    const semPendentesNoFiltro = filtro === 'pendentes';
    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200">
        {cabecalho}
        <div className="p-10 text-center space-y-4">
          {semPendentesNoFiltro ? (
            abaValida === 'todas' ? (
              <>
                <div className="text-2xl">🎉 Todas as fotos revisadas!</div>
                <button onClick={() => escolherFiltro('treinadas')} className="bg-[#28499f] hover:bg-[#1a3270] text-white rounded-md px-4 py-2 text-sm font-semibold">Ir para as treinadas</button>
              </>
            ) : (
              <>
                <div className="text-2xl">✅ {nomeMarca(abaValida)} concluída</div>
                {proximaMarca && <button onClick={() => escolherAba(proximaMarca.marca)} className="bg-emerald-600 hover:bg-emerald-500 text-black rounded-md px-4 py-2 text-sm font-semibold">Próxima: {nomeMarca(proximaMarca.marca)} ({proximaMarca.pendentes} pendentes)</button>}
                <div><button onClick={() => escolherFiltro('treinadas')} className="text-sm text-slate-400 underline">Ver as treinadas de {nomeMarca(abaValida)}</button></div>
              </>
            )
          ) : (
            <div className="text-slate-400">Nenhuma foto neste filtro.</div>
          )}
        </div>
      </div>
    );
  }

  const badge = badgePrioridade(foto._prio);
  const statusFoto = statusDe(foto);

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-200">
      {cabecalho}

      <main className="max-w-6xl mx-auto p-6 grid md:grid-cols-[340px_1fr] gap-6">
        <div className="relative rounded-xl overflow-hidden bg-[#161b22] border border-slate-700 aspect-square">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={foto.url} alt="Volante" className="w-full h-full object-cover" />
          <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded ${badge.classe}`}>{badge.texto}</span>
          {estaIgnorada && <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-red-600 text-white">IGNORADA</span>}
          {statusFoto === 'treinada' && <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-600 text-white">TREINADA</span>}
          <span className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/85 to-transparent px-3 pt-6 pb-2 text-[11px] font-mono text-white/70">
            #{foto.id} · {foto.marca} / {foto.modelo_slug}
          </span>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-wide text-slate-400 block mb-2">Modelos compatíveis com esta foto</span>
            <div className="flex flex-col gap-1.5">
              {modelos.length === 0 && <span className="text-sm italic text-slate-500">Nenhum modelo adicionado ainda</span>}
              {modelos.map((m, i) => (
                <div key={i} className="flex items-center gap-2 bg-[#28499f]/20 border border-[#28499f]/40 rounded-md px-2.5 py-1.5 text-sm">
                  <span className="text-[10px] text-blue-300 bg-[#28499f]/30 px-1.5 py-0.5 rounded font-bold">{m.marca}</span>
                  <span>{m.modelo}</span>
                  <span className="ml-auto text-[11px] text-amber-400">{m.anoMin || '?'} – {m.anoMax || '?'}</span>
                  <button className="text-red-400 text-base px-1" onClick={() => setModelos((p) => p.filter((_, j) => j !== i))}>×</button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
            <span className="text-[11px] uppercase tracking-wide text-purple-300 block mb-2">⚡ Copiar modelos de uma foto já treinada</span>
            <div className="flex gap-2">
              <input value={copiarId} onChange={(e) => setCopiarId(e.target.value)} placeholder="Cole o ID da foto (ex: 123)"
                className="flex-1 bg-[#0d1117] border border-purple-500/40 rounded-md px-3 py-2 text-sm outline-none focus:border-purple-400" />
              <button onClick={aplicarCopia} className="bg-purple-600 hover:bg-purple-500 text-white rounded-md px-3.5 py-2 text-sm font-semibold">Copiar</button>
            </div>
          </div>

          <div className="bg-[#161b22] border border-slate-700 rounded-lg p-3 flex flex-col gap-2.5">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">+ Adicionar modelo manualmente</span>
            <div className="relative">
              <input ref={buscaRef} value={busca} onChange={(e) => { setBusca(e.target.value); setSugAberta(true); }}
                onKeyDown={(e) => { if (e.key === 'Enter') adicionar(sugestoes[0]?.m, sugestoes[0]?.ma); }}
                placeholder="Modelo (ex: Onix, Gol G6…)"
                className="w-full bg-[#0d1117] border border-slate-700 rounded-md px-3 py-2 text-sm outline-none focus:border-blue-500" />
              {sugAberta && sugestoes.length > 0 && (
                <div className="absolute z-10 top-full inset-x-0 bg-[#1c2128] border border-slate-700 rounded-b-lg max-h-56 overflow-y-auto">
                  {sugestoes.map((m, i) => (
                    <div key={i} onClick={() => adicionar(m.m, m.ma)}
                      className="px-3 py-2 text-sm cursor-pointer hover:bg-[#28499f]/30 flex items-center gap-2">
                      <span className="text-[10px] text-blue-300 bg-[#28499f]/20 px-1.5 py-0.5 rounded font-bold">{m.ma}</span>
                      {m.m}<span className="ml-auto text-[10px] text-emerald-400">{m.f}×</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input type="number" value={anoMin} onChange={(e) => setAnoMin(e.target.value)} placeholder="De" className="w-20 bg-[#0d1117] border border-slate-700 rounded-md px-2.5 py-2 text-sm outline-none" />
              <span className="text-slate-400 text-sm">até</span>
              <input type="number" value={anoMax} onChange={(e) => setAnoMax(e.target.value)} placeholder="Até" className="w-20 bg-[#0d1117] border border-slate-700 rounded-md px-2.5 py-2 text-sm outline-none" />
              <button onClick={() => adicionar()} className="ml-auto bg-[#28499f] hover:bg-[#1a3270] text-white rounded-md px-4 py-2 text-sm font-semibold">+ Adicionar</button>
            </div>
          </div>

          {msg && <div className={`text-sm ${msg.t === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.m}</div>}

          <div className="flex flex-col gap-2">
            <button disabled={salvando} onClick={() => salvar(modelos)}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-semibold rounded-md py-3">✓ Salvar e próxima</button>
            <button disabled={salvando} onClick={() => salvar([{ modelo: 'IGNORAR', marca: '', anoMin: null, anoMax: null }])}
              className="w-full border border-red-500/50 text-red-400 rounded-md py-2.5 text-sm hover:bg-red-500/10">✗ Não é volante / irrelevante</button>
            <button onClick={proxima} className="w-full border border-slate-700 text-slate-400 rounded-md py-2.5 text-sm hover:text-slate-200">→ Pular esta foto</button>
          </div>
        </div>
      </main>
    </div>
  );
}
