'use client';
// app/admin/bot/componentes/RevisaoTabs.js
// Sugestões (15.12), Sombra (15.20) e Avisos (15.21).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Aviso, btnAzul, btnCinza, cartao, fmtData, fmtFone, inputCls, useAoMontar } from './comum';

// ───────────── Sugestões ─────────────
export function SugestoesTab({ api }) {
  const [lista, setLista] = useState(null);
  const [status, setStatus] = useState('pendente');
  const [rascunho, setRascunho] = useState({}); // id -> {pergunta, resposta_humana}

  const carregar = useCallback(async () => {
    try { setLista(await api.get('sugestoes', { status })); } catch (e) { toast.error(e.message); setLista([]); }
  }, [api, status]);
  useAoMontar(carregar);

  const val = (s) => rascunho[s.id] || { pergunta: s.pergunta, resposta_humana: s.resposta_humana };
  const set = (s, campo, v) => setRascunho((r) => ({ ...r, [s.id]: { ...val(s), [campo]: v } }));

  async function converter(s, destino) {
    try {
      await api.post({ action: 'sugestao_converter', id: s.id, destino, ...val(s) });
      toast.success(destino === 'faq' ? 'Virou FAQ!' : 'Virou objeção!');
      await carregar();
    } catch (e) { toast.error(e.message); }
  }
  async function descartar(s) {
    try { await api.post({ action: 'sugestao_descartar', id: s.id }); toast.success('Descartada'); await carregar(); } catch (e) { toast.error(e.message); }
  }
  async function salvarEdicao(s) {
    try { await api.post({ action: 'sugestao_editar', id: s.id, ...val(s) }); toast.success('Salvo'); await carregar(); } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select className={`${inputCls} md:w-52`} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pendente">Pendentes</option><option value="faq">Viraram FAQ</option><option value="objecao">Viraram objeção</option>
          <option value="descartada">Descartadas</option><option value="todas">Todas</option>
        </select>
        <span className="text-xs text-slate-500">Nada entra no bot sem a sua aprovação. Quem respondeu: Maria ou Wildson.</span>
      </div>
      {!lista && <div className="text-slate-400 text-sm">Carregando…</div>}
      {lista && lista.length === 0 && <div className={`${cartao} text-center text-slate-500`}>Nenhuma sugestão {status === 'pendente' ? 'pendente' : 'neste filtro'}.</div>}
      {(lista || []).map((s) => (
        <div key={s.id} className={`${cartao} space-y-3`}>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{fmtFone(s.chatid)} · respondido por <b>{s.respondido_por || '—'}</b></span><span>{fmtData(s.created_at)} · {s.status}</span>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div><label className="text-xs font-bold text-slate-500">Pergunta do cliente</label>
              <textarea disabled={s.status !== 'pendente'} className={`${inputCls} h-24`} value={val(s).pergunta} onChange={(e) => set(s, 'pergunta', e.target.value)} /></div>
            <div><label className="text-xs font-bold text-slate-500">Resposta da equipe</label>
              <textarea disabled={s.status !== 'pendente'} className={`${inputCls} h-24`} value={val(s).resposta_humana} onChange={(e) => set(s, 'resposta_humana', e.target.value)} /></div>
          </div>
          {s.status === 'pendente' && (
            <div className="flex flex-wrap gap-2">
              <button className={btnAzul} onClick={() => converter(s, 'faq')}>→ Virar FAQ</button>
              <button className="bg-violet-600 text-white font-bold py-2.5 px-5 rounded-xl text-sm hover:bg-violet-700" onClick={() => converter(s, 'objecao')}>→ Virar objeção</button>
              <button className={btnCinza} onClick={() => salvarEdicao(s)}>Salvar edição</button>
              <button className="text-red-600 font-bold py-2 px-4 rounded-xl text-sm hover:bg-red-50" onClick={() => descartar(s)}>Descartar</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ───────────── Sombra ─────────────
// Texto "bot diria": acao_bot é jsonb (formato definido pelo bot) → extrai o texto se existir.
function textoDoBot(a) {
  if (!a) return '';
  if (typeof a === 'string') return a;
  const t = a.text || a.texto || a.reply || a.resposta;
  const tipo = a.action || a.type || a.tipo;
  return (tipo ? `[${tipo}] ` : '') + (t || '');
}

export function SombraTab({ api }) {
  const [dados, setDados] = useState(null);
  const [filtro, setFiltro] = useState('pendentes');
  const [verJson, setVerJson] = useState({});

  const carregar = useCallback(async () => {
    try { setDados(await api.get('sombra', { filtro })); } catch (e) { toast.error(e.message); setDados({ itens: [], semana: null }); }
  }, [api, filtro]);
  useAoMontar(carregar);

  async function avaliar(l, avaliacao) {
    try {
      const r = await api.post({ action: 'sombra_avaliar', id: l.id, avaliacao });
      toast.success(avaliacao === 'virar_faq' ? (r.sugestao_criada ? 'Enviado para Sugestões' : 'Já existe sugestão pendente igual') : 'Avaliado');
      await carregar();
    } catch (e) { toast.error(e.message); }
  }
  const sem = dados?.semana;

  return (
    <div className="space-y-4">
      <div className={`${cartao} flex flex-wrap items-center gap-6`}>
        <div>
          <p className="text-xs text-slate-500">Taxa de acerto (últimos 7 dias)</p>
          <p className="text-3xl font-black text-slate-800">{sem?.taxa_acerto != null ? `${sem.taxa_acerto}%` : '—'}</p>
        </div>
        <div className="text-sm text-slate-600">✅ {sem?.acertou ?? 0} acertou · ❌ {sem?.errou ?? 0} errou · ➕ {sem?.virar_faq ?? 0} virar FAQ
          <div className="text-xs text-slate-400">taxa = acertou ÷ (acertou + errou); ➕ não entra na conta.</div></div>
        <select className={`${inputCls} md:w-52 ml-auto`} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="pendentes">Sem avaliação</option><option value="acertou">✅ Acertou</option><option value="errou">❌ Errou</option>
          <option value="virar_faq">➕ Virar FAQ</option><option value="todas">Todas</option>
        </select>
      </div>
      {!dados && <div className="text-slate-400 text-sm">Carregando…</div>}
      {dados && dados.itens.length === 0 && <div className={`${cartao} text-center text-slate-500`}>Nenhuma linha neste filtro.</div>}
      {(dados?.itens || []).map((l) => (
        <div key={l.id} className={`${cartao} space-y-3`}>
          <div className="flex justify-between text-xs text-slate-500">
            <span>{fmtFone(l.chatid)}{l.cidade ? ` · ${l.cidade}` : ''}</span><span>{fmtData(l.created_at)}{l.avaliacao ? ` · ${l.avaliacao}` : ''}</span>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-sm"><b className="text-xs text-slate-500">Cliente:</b> {l.mensagem_cliente || '—'}</div>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm whitespace-pre-wrap">
              <b className="text-xs text-blue-700">🤖 Bot diria</b><br />
              {l.skip_motivo ? <span className="text-amber-700">(não responderia — skip: {l.skip_motivo})</span> : (textoDoBot(l.acao_bot) || <i className="text-slate-400">—</i>)}
              {l.acao_bot && <button className="block text-[11px] text-blue-600 mt-1 underline" onClick={() => setVerJson((v) => ({ ...v, [l.id]: !v[l.id] }))}>{verJson[l.id] ? 'ocultar JSON' : 'ver JSON'}</button>}
              {verJson[l.id] && <pre className="text-[11px] bg-white rounded p-2 mt-1 overflow-x-auto">{JSON.stringify(l.acao_bot, null, 2)}</pre>}
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 text-sm whitespace-pre-wrap">
              <b className="text-xs text-emerald-700">👩 Maria respondeu</b><br />{l.resposta_humana || <i className="text-slate-400">ainda sem resposta da equipe</i>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className={`${btnCinza} ${l.avaliacao === 'acertou' ? '!bg-emerald-600 !text-white' : ''}`} onClick={() => avaliar(l, 'acertou')}>✅ Acertou</button>
            <button className={`${btnCinza} ${l.avaliacao === 'errou' ? '!bg-red-600 !text-white' : ''}`} onClick={() => avaliar(l, 'errou')}>❌ Errou</button>
            <button className={`${btnCinza} ${l.avaliacao === 'virar_faq' ? '!bg-violet-600 !text-white' : ''}`} onClick={() => avaliar(l, 'virar_faq')} title="Cria uma sugestão (pergunta + resposta da Maria) na aba Sugestões">➕ Virar FAQ/objeção</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────── Avisos ─────────────
const STATUS_ENTREGA = [
  ['enviado', 'Enviado'], ['na_fila_resumo', 'Na fila do resumo'], ['enviado_no_resumo', 'Enviado no resumo'],
  ['suprimido_sombra', 'Suprimido (sombra)'], ['suprimido_antispam', 'Suprimido (anti-spam)'], ['suprimido_toggle', 'Suprimido (motivo desligado)'], ['erro_envio', 'Erro de envio'],
];
const MOTIVOS = ['foto', 'audio', 'desconto', 'remarcacao', 'cancelamento', 'atraso', 'erro_ia', 'guardrail', 'opt-out', 'sem_foto_modelo', 'pessoa_especifica', 'agendamento_em_cima_da_hora'];
const corStatus = (s) => (s === 'enviado' || s === 'enviado_no_resumo' ? 'bg-emerald-100 text-emerald-700' : s === 'erro_envio' ? 'bg-red-100 text-red-700' : s === 'na_fila_resumo' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600');

export function AvisosTab({ api }) {
  const [f, setF] = useState({ periodo: '7d', motivo: '', status: '', modo: '' });
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(async () => {
    try { setDados(await api.get('avisos', f)); setErro(null); } catch (e) { setErro(e.message); setDados({ itens: [], hoje: null }); }
  }, [api, f]);
  useAoMontar(carregar);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const h = dados?.hoje;

  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">Erro ao carregar avisos: {erro} (a migração bot-v2 foi aplicada?)</Aviso>}
      <div className={`${cartao} text-sm font-semibold text-slate-700`}>
        Hoje: {h?.total ?? 0} aviso(s) · {h?.enviados ?? 0} enviado(s) · {h?.na_fila ?? 0} na fila do resumo · {h?.suprimidos ?? 0} suprimido(s) · {h?.erros ?? 0} com erro
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <select className={inputCls} value={f.periodo} onChange={(e) => set('periodo', e.target.value)}>
          <option value="hoje">Hoje</option><option value="7d">7 dias</option><option value="30d">30 dias</option><option value="todos">Tudo (últimos 300)</option></select>
        <select className={inputCls} value={f.motivo} onChange={(e) => set('motivo', e.target.value)}><option value="">Todos os motivos</option>{MOTIVOS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        <select className={inputCls} value={f.status} onChange={(e) => set('status', e.target.value)}><option value="">Todos os status</option>{STATUS_ENTREGA.map(([v, r]) => <option key={v} value={v}>{r}</option>)}</select>
        <select className={inputCls} value={f.modo} onChange={(e) => set('modo', e.target.value)}><option value="">Todos os modos</option><option value="sombra">Sombra</option><option value="producao">Produção</option><option value="teste">Teste</option></select>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {!dados && <div className="p-8 text-center text-slate-400">Carregando…</div>}
        {dados && dados.itens.length === 0 && <div className="p-8 text-center text-slate-500">Nenhum aviso neste filtro.</div>}
        {(dados?.itens || []).map((a) => (
          <div key={a.id} className="p-4 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-500">{fmtData(a.created_at)}</span>
              <span className="font-bold text-slate-800 text-sm">{a.nome || fmtFone(a.telefone || a.chatid)}</span>
              {a.cidade && <span className="text-slate-500">· {a.cidade}</span>}
              <span className="bg-blue-100 text-blue-700 rounded px-2 py-0.5 font-bold">{a.motivo}</span>
              <span className={`rounded px-2 py-0.5 font-bold ${corStatus(a.status_entrega)}`}>{a.status_entrega}</span>
              <span className="bg-slate-100 text-slate-600 rounded px-2 py-0.5">{a.modo}</span>
              {a.ghl_link && <a href={a.ghl_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline ml-auto">abrir no GHL</a>}
            </div>
            {a.ultima_mensagem && <p className="text-sm text-slate-600"><b>Cliente:</b> {a.ultima_mensagem}</p>}
            {a.texto_aviso && <p className="text-xs text-slate-500 whitespace-pre-wrap bg-slate-50 rounded p-2">{a.texto_aviso}</p>}
            {(a.destino || a.notified_at) && <p className="text-xs text-slate-400">destino: {a.destino || '—'} · enviado: {fmtData(a.notified_at)}</p>}
            {a.erro && <p className="text-xs text-red-600">erro: {a.erro}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
