'use client';
// app/admin/bot/componentes/ConversasTab.js
// Conversas (log + último skip + handoffs abertos + resumo do dia), controle por contato
// e Simulador dry-run (item 12).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ThumbsUp, ThumbsDown, Search } from 'lucide-react';
import { Aviso, btnAzul, btnCinza, cartao, fmtData, fmtFone, inputCls, useAoMontar } from './comum';

const corStatus = { ativo: 'bg-emerald-100 text-emerald-700', pausado: 'bg-amber-100 text-amber-700', ignorado: 'bg-slate-200 text-slate-600', aguardando_humano: 'bg-red-100 text-red-700' };
const rotuloStatus = { ativo: 'ativo', pausado: 'pausado', ignorado: 'ignorado', aguardando_humano: 'aguardando humano' };

// ───────────── Controle por contato (16.6) ─────────────
export function ContatoControle({ api, papel }) {
  const [q, setQ] = useState('');
  const [itens, setItens] = useState(null);
  const [horas, setHoras] = useState('');
  const buscar = useCallback(async (termo) => {
    try { const r = await api.get('contatos', { q: termo }); setItens(r.itens); } catch (e) { toast.error(e.message); }
  }, [api]);

  async function acao(c, a) {
    try {
      const r = await api.post({ action: 'contato_acao', chatid: c.chatid, acao: a, horas: a === 'pausar' ? horas : undefined });
      if (r.ghl && r.ghl.ok === false) toast(`Salvo no bot, mas o GHL não sincronizou as tags: ${r.ghl.erro}`, { icon: '⚠️', duration: 7000 });
      else toast.success('Feito!');
      await buscar(q);
    } catch (e) { toast.error(e.message); }
  }

  return (
    <div className={`${cartao} space-y-3`}>
      <h3 className="font-bold text-slate-800">Controle por contato</h3>
      <form onSubmit={(e) => { e.preventDefault(); buscar(q); }} className="flex gap-2 flex-wrap">
        <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Buscar por telefone ou nome" value={q} onChange={(e) => setQ(e.target.value)} />
        <input className={`${inputCls} w-40`} type="number" min="1" placeholder="pausar por (h)" value={horas} onChange={(e) => setHoras(e.target.value)} title="Vazio = pausar até retomar (tag bot-off no GHL)" />
        <button type="submit" className={btnAzul}><Search size={14} className="inline mr-1" />Buscar</button>
      </form>
      <p className="text-xs text-slate-500">Pausar com horas: só pausa no bot até lá. Sem horas: pausa até retomar e aplica a tag <code>bot-off</code> no GHL. Retomar: limpa a pausa e aplica <code>bot-ativo</code>.</p>
      {itens && itens.length === 0 && <div className="text-sm text-slate-500">Nenhum contato encontrado.</div>}
      {(itens || []).map((c) => (
        <div key={c.chatid} className="border border-slate-100 rounded-xl p-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="text-sm">
            <b className="text-slate-800">{c.name || fmtFone(c.phone || c.chatid)}</b> <span className="text-slate-500">{fmtFone(c.phone || c.chatid)}{c.city ? ` · ${c.city}` : ''}</span>
            <div className="mt-1 flex gap-2 items-center">
              <span className={`text-xs font-bold rounded px-2 py-0.5 ${corStatus[c.status]}`}>{rotuloStatus[c.status]}</span>
              {c.paused_until && new Date(c.paused_until) > new Date() && <span className="text-xs text-slate-500">até {fmtData(c.paused_until)}</span>}
              {c.ghl_link && <a href={c.ghl_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">GHL</a>}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className={btnCinza} onClick={() => acao(c, 'pausar')}>⏸ Pausar</button>
            <button className={btnCinza} onClick={() => acao(c, 'retomar')}>▶ Retomar</button>
            {papel === 'admin' && (c.status === 'ignorado'
              ? <button className={btnCinza} onClick={() => acao(c, 'designorar')}>Remover dos ignorados</button>
              : <button className={btnCinza} onClick={() => { if (confirm('Adicionar este número à lista de ignorados (nunca tratado como lead)?')) acao(c, 'ignorar'); }}>🚫 Ignorar</button>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────────── Conversas ─────────────
export function ConversasTab({ api, papel }) {
  const [dados, setDados] = useState(null);
  const [ativa, setAtiva] = useState(null);

  const carregar = useCallback(async () => {
    try { setDados(await api.get('conversas')); } catch (e) { toast.error(e.message); }
  }, [api]);
  useAoMontar(carregar);

  const grupos = {};
  for (const m of dados?.mensagens || []) (grupos[m.contact_id] ||= []).push(m);
  const conversas = Object.entries(grupos).map(([id, msgs]) => ({ id, msgs: [...msgs].reverse(), ultima: msgs[0]?.created_at }))
    .sort((a, b) => new Date(b.ultima) - new Date(a.ultima));
  const conv = conversas.find((c) => c.id === ativa);
  const dia = dados?.dia;

  async function avaliar(id, rating) {
    try { await api.post({ action: 'rate_conversation', id, rating }); await carregar(); } catch (e) { toast.error(e.message); }
  }

  return (
    <div className="space-y-4">
      {dados?.faltando?.length > 0 && <Aviso tipo="alerta">Tabela(s) ainda não existem ({dados.faltando.join(', ')}): aplique a migração bot-v2. Os dados de skip/avisos aparecerão depois.</Aviso>}
      {dia && (
        <div className={`${cartao} text-sm text-slate-700`}>
          <b>Hoje:</b> {dia.respostas} resposta(s) · {dia.agendamentos} agendamento(s) · {dia.handoffs} handoff(s) · {dia.erros_ia} erro(s) de IA · {dia.guardrails} guardrail(s)
          {Object.keys(dia.skips).length > 0 && <> · skips: {Object.entries(dia.skips).map(([k, v]) => `${k} ${v}`).join(', ')}</>}
        </div>
      )}
      {papel === 'operador' && <ContatoControle api={api} papel={papel} />}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col md:flex-row h-[700px]">
        <div className="w-full md:w-1/3 border-r border-gray-100 overflow-y-auto bg-slate-50">
          {!dados && <div className="p-4 text-slate-400 text-sm">Carregando…</div>}
          {conversas.map((c) => {
            const lead = dados.leads[c.id]; const skip = dados.ultimo_skip[c.id]; const hs = dados.handoffs_abertos[c.id] || [];
            return (
              <div key={c.id} className={`p-4 border-b border-gray-100 hover:bg-white cursor-pointer ${ativa === c.id ? 'bg-white shadow-sm' : ''}`} onClick={() => setAtiva(c.id)}>
                <div className="flex justify-between items-center mb-1">
                  <p className="font-bold text-slate-800 truncate">{lead?.name || fmtFone(c.id)}</p>
                  <span className="text-[10px] text-slate-400">{fmtData(c.ultima)}</span>
                </div>
                <p className="text-xs text-slate-500 truncate">{c.msgs[c.msgs.length - 1]?.content}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {skip?.motivo && <span className="text-[10px] bg-slate-200 text-slate-700 rounded px-1.5 py-0.5" title={fmtData(skip.em)}>skip: {skip.motivo}</span>}
                  {hs.length > 0 && <span className="text-[10px] bg-red-100 text-red-700 rounded px-1.5 py-0.5 font-bold">{hs.length} handoff(s) aberto(s)</span>}
                  {lead?.paused_until && new Date(lead.paused_until) > new Date() && <span className="text-[10px] bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">pausado</span>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-1 flex flex-col bg-slate-50/50 min-w-0">
          {conv ? (
            <>
              <div className="p-4 border-b border-gray-100 bg-white shadow-sm z-10 space-y-1">
                <div className="flex justify-between items-center font-bold text-slate-800">
                  <span>{dados.leads[conv.id]?.name || fmtFone(conv.id)} <span className="font-normal text-slate-500 text-sm">{fmtFone(conv.id)}{dados.leads[conv.id]?.city ? ` · ${dados.leads[conv.id].city}` : ''}</span></span>
                  {dados.leads[conv.id]?.ghl_link && <a href={dados.leads[conv.id].ghl_link} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">abrir no GHL</a>}
                </div>
                {dados.ultimo_skip[conv.id] && <div className="text-xs text-slate-600">Último skip: <b>{dados.ultimo_skip[conv.id].motivo || '—'}</b> em {fmtData(dados.ultimo_skip[conv.id].em)}</div>}
                {(dados.handoffs_abertos[conv.id] || []).map((h) => (
                  <div key={h.id} className="text-xs text-red-700">🙋 Handoff aberto: <b>{h.motivo}</b> ({h.status_entrega}, {h.modo}) em {fmtData(h.created_at)} {h.ghl_link && <a href={h.ghl_link} target="_blank" rel="noopener noreferrer" className="underline">GHL</a>}</div>
                ))}
              </div>
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {conv.msgs.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-white border border-gray-200 text-slate-700 rounded-bl-none shadow-sm' : 'bg-green-600 text-white rounded-br-none'}`}>
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                      <div className="flex gap-1 mt-2 justify-end opacity-60 hover:opacity-100">
                        <button onClick={() => avaliar(msg.id, 'up')} className={`p-1 rounded ${msg.rating === 'up' ? 'text-blue-500 bg-blue-50' : 'text-slate-400 hover:bg-slate-100'}`}><ThumbsUp size={14} /></button>
                        <button onClick={() => avaliar(msg.id, 'down')} className={`p-1 rounded ${msg.rating === 'down' ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:bg-slate-100'}`}><ThumbsDown size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Selecione uma conversa à esquerda</div>}
        </div>
      </div>
    </div>
  );
}

// ───────────── Simulador (dry-run) ─────────────
export function SimuladorTab({ api }) {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [rodando, setRodando] = useState(false);
  const [saida, setSaida] = useState(null);

  async function simular(e) {
    e.preventDefault();
    setRodando(true); setSaida(null);
    try { const r = await api.post({ action: 'simular', phone, message }); setSaida({ ok: true, r: r.resultado }); }
    catch (err) { setSaida({ ok: false, erro: err.message }); }
    finally { setRodando(false); }
  }
  const r = saida?.r;
  const acao = r?.action || r?.acao;
  const texto = acao?.text || acao?.texto || r?.reply;

  return (
    <div className="space-y-4">
      <Aviso tipo="info"><b>Simular como contato do GHL.</b> Informe o telefone de um contato real e a mensagem. O bot usa o mesmo caminho do atendimento real (histórico do GHL, agenda, estado) em modo <b>dry-run</b>: nada é enviado pelo Zaptos e nada é gravado no GHL. Requer a versão nova do bot (PR 1) com suporte a <code>dry_run</code> no <code>/api/bot/test</code> e <code>BOT_TEST_SECRET</code> no servidor do painel.</Aviso>
      <form onSubmit={simular} className={`${cartao} space-y-3`}>
        <input className={inputCls} placeholder="Telefone do contato (ex.: 5531999999999)" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <textarea className={`${inputCls} h-24`} placeholder="Mensagem do cliente" value={message} onChange={(e) => setMessage(e.target.value)} />
        <button className={btnAzul} disabled={rodando || !phone.trim() || !message.trim()}>{rodando ? 'Simulando… (pode levar até 1 min)' : 'Simular'}</button>
      </form>
      {saida && !saida.ok && <Aviso tipo="erro">{saida.erro}</Aviso>}
      {saida?.ok && (
        <div className={`${cartao} space-y-3`}>
          {acao && <div className="text-sm"><b>Ação:</b> <code className="bg-slate-100 px-2 py-0.5 rounded">{acao.type || acao.action || acao.tipo || '—'}</code></div>}
          {texto && <div className="bg-green-600 text-white rounded-2xl rounded-br-none p-3 text-sm whitespace-pre-wrap max-w-xl">{texto}</div>}
          <details open><summary className="cursor-pointer text-sm font-bold text-slate-700">JSON completo</summary>
            <pre className="text-xs bg-slate-900 text-slate-100 rounded-xl p-3 mt-2 overflow-x-auto max-h-96">{JSON.stringify(r, null, 2)}</pre></details>
        </div>
      )}
    </div>
  );
}
