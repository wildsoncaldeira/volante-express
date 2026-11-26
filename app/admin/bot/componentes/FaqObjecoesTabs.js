'use client';
// app/admin/bot/componentes/FaqObjecoesTabs.js
// FAQ e Objeções (lista editável + importação em massa "gatilhos | resposta | ação").
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Trash2, Pencil, Save, X } from 'lucide-react';
import { Aviso, btnAzul, btnCinza, cartao, inputCls, useAoMontar } from './comum';

export function FaqTab({ api }) {
  const [lista, setLista] = useState(null);
  const [edit, setEdit] = useState(null); // {id, question, answer}
  const [nova, setNova] = useState({ question: '', answer: '' });
  const carregar = useCallback(async () => {
    try { setLista(await api.get('faqs')); } catch (e) { toast.error(e.message); }
  }, [api]);
  useAoMontar(carregar);

  async function acao(payload, ok) {
    try { await api.post(payload); toast.success(ok); await carregar(); return true; } catch (e) { toast.error(e.message); return false; }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={async (e) => { e.preventDefault(); if (await acao({ action: 'add_faq', ...nova }, 'FAQ adicionado!')) setNova({ question: '', answer: '' }); }}
        className={`${cartao} flex flex-col md:flex-row gap-4`}>
        <input className={`${inputCls} flex-1`} placeholder="Pergunta (Ex.: Qual o valor?)" value={nova.question} onChange={(e) => setNova({ ...nova, question: e.target.value })} />
        <input className={`${inputCls} flex-1`} placeholder="Resposta" value={nova.answer} onChange={(e) => setNova({ ...nova, answer: e.target.value })} />
        <button type="submit" className={btnAzul}>Adicionar FAQ</button>
      </form>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {(lista || []).map((f) => (
          <div key={f.id} className="p-4 flex items-start justify-between gap-4">
            {edit?.id === f.id ? (
              <div className="flex-1 space-y-2">
                <input className={inputCls} value={edit.question} onChange={(e) => setEdit({ ...edit, question: e.target.value })} />
                <textarea className={`${inputCls} h-24`} value={edit.answer} onChange={(e) => setEdit({ ...edit, answer: e.target.value })} />
                <div className="flex gap-2">
                  <button className={btnAzul} onClick={async () => { if (await acao({ action: 'update_faq', ...edit }, 'FAQ atualizado!')) setEdit(null); }}><Save size={14} className="inline mr-1" />Salvar</button>
                  <button className={btnCinza} onClick={() => setEdit(null)}><X size={14} className="inline mr-1" />Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <p className="font-bold text-slate-800">{f.question}</p>
                  <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap">{f.answer}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button title="Editar" onClick={() => setEdit({ id: f.id, question: f.question, answer: f.answer })} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Pencil size={16} /></button>
                  <button title="Excluir" onClick={() => { if (confirm('Excluir esta FAQ?')) acao({ action: 'delete_faq', id: f.id }, 'FAQ removido'); }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {lista && lista.length === 0 && <div className="p-8 text-center text-slate-500">Nenhuma FAQ cadastrada.</div>}
        {!lista && <div className="p-8 text-center text-slate-400">Carregando…</div>}
      </div>
    </div>
  );
}

const ACOES = [['responder', 'Responder'], ['chamar_maria', 'Chamar a Maria']];

export function ObjecoesTab({ api }) {
  const [lista, setLista] = useState(null);
  const [edit, setEdit] = useState(null); // {id?, gatilhosTxt, resposta, acao, ativo, ordem}
  const [texto, setTexto] = useState('');
  const [previa, setPrevia] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try { setLista(await api.get('objecoes')); } catch (e) { toast.error(e.message); }
  }, [api]);
  useAoMontar(carregar);

  async function salvarEdicao() {
    try {
      const r = await api.post({
        action: 'objecao_salvar', id: edit.id, gatilhos: edit.gatilhosTxt.split(';'), resposta: edit.resposta,
        acao: edit.acao, ativo: edit.ativo, ordem: Number(edit.ordem) || 0,
      });
      (r.avisos || []).forEach((a) => toast(a, { icon: '⚠️' }));
      toast.success('Objeção salva!'); setEdit(null); await carregar();
    } catch (e) { toast.error(e.message); }
  }
  async function alternar(o) {
    try { await api.post({ action: 'objecao_salvar', id: o.id, gatilhos: o.gatilhos, resposta: o.resposta, acao: o.acao, ativo: !o.ativo, ordem: o.ordem }); await carregar(); }
    catch (e) { toast.error(e.message); }
  }
  async function importar(confirmar) {
    setOcupado(true);
    try {
      const r = await api.post({ action: 'objecoes_importar', texto, confirmar });
      setPrevia(r);
      if (r.gravado) {
        toast.success(`${r.inseridas} objeção(ões) importada(s)${r.puladas_duplicadas ? `, ${r.puladas_duplicadas} duplicada(s) ignorada(s)` : ''}`);
        setTexto(''); setPrevia(null); await carregar();
      }
    } catch (e) { toast.error(e.message); }
    finally { setOcupado(false); }
  }

  return (
    <div className="space-y-6">
      <div className={`${cartao} space-y-3`}>
        <h3 className="font-bold text-slate-800">Importação em massa</h3>
        <p className="text-xs text-slate-500">
          Uma objeção por linha: <code>gatilhos | resposta | ação</code>. Gatilhos separados por <code>;</code>. Ação: <code>responder</code> ou <code>chamar_maria</code> (vazia = responder).
          Variáveis: <code>{'{preco_pix} {preco_cartao} {local} {city} {date}'}</code>. Linhas começadas por # são ignoradas. Objeções com os mesmos gatilhos já cadastradas são puladas.
        </p>
        <textarea className={`${inputCls} h-40 font-mono`} value={texto} onChange={(e) => { setTexto(e.target.value); setPrevia(null); }}
          placeholder={'caro; muito caro; desconto | Entendo! O valor é R$ {preco_pix} no Pix e R$ {preco_cartao} no cartão. | responder\ngarantia; deu problema | Vou chamar a equipe para te ajudar. | chamar_maria'} />
        <div className="flex gap-3 flex-wrap">
          <button className={btnCinza} disabled={ocupado || !texto.trim()} onClick={() => importar(false)}>Validar (prévia)</button>
          <button className={btnAzul} disabled={ocupado || !previa || previa.erros?.length > 0 || previa.total === 0} onClick={() => importar(true)}>Importar {previa?.total ? `${previa.total} objeção(ões)` : ''}</button>
        </div>
        {previa && (
          <div className="space-y-2">
            <Aviso tipo={previa.erros.length ? 'erro' : 'ok'}>{previa.total} linha(s) válida(s), {previa.erros.length} com erro, {previa.avisos.length} aviso(s).</Aviso>
            {previa.erros.map((e, i) => <div key={i} className="text-xs text-red-600">❌ <code>{e.linha.slice(0, 80)}</code> — {e.motivo}</div>)}
            {previa.avisos.map((e, i) => <div key={i} className="text-xs text-amber-600">⚠️ <code>{e.linha.slice(0, 80)}</code> — {e.motivo}</div>)}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Objeções cadastradas ({lista?.length ?? '…'})</h3>
        <button className={btnAzul} onClick={() => setEdit({ gatilhosTxt: '', resposta: '', acao: 'responder', ativo: true, ordem: (lista?.length || 0) + 1 })}>+ Nova objeção</button>
      </div>

      {edit && (
        <div className={`${cartao} space-y-3 border-blue-200`}>
          <input className={inputCls} placeholder="Gatilhos separados por ;" value={edit.gatilhosTxt} onChange={(e) => setEdit({ ...edit, gatilhosTxt: e.target.value })} />
          <textarea className={`${inputCls} h-24`} placeholder="Resposta" value={edit.resposta} onChange={(e) => setEdit({ ...edit, resposta: e.target.value })} />
          <div className="flex flex-wrap gap-3 items-center">
            <select className={`${inputCls} md:w-52`} value={edit.acao} onChange={(e) => setEdit({ ...edit, acao: e.target.value })}>
              {ACOES.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
            <label className="text-sm flex items-center gap-1.5"><input type="checkbox" checked={edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} /> ativa</label>
            <label className="text-sm flex items-center gap-1.5">ordem <input type="number" className="w-20 p-2 border border-slate-200 rounded-lg" value={edit.ordem} onChange={(e) => setEdit({ ...edit, ordem: e.target.value })} /></label>
            <button className={btnAzul} onClick={salvarEdicao}>Salvar</button>
            <button className={btnCinza} onClick={() => setEdit(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-100">
        {(lista || []).map((o) => (
          <div key={o.id} className={`p-4 flex items-start justify-between gap-4 ${o.ativo ? '' : 'opacity-50'}`}>
            <div className="min-w-0">
              <div className="flex flex-wrap gap-1.5 mb-1">
                {(o.gatilhos || []).map((g) => <span key={g} className="text-[11px] bg-slate-100 rounded px-2 py-0.5 text-slate-600">{g}</span>)}
                <span className={`text-[11px] rounded px-2 py-0.5 font-bold ${o.acao === 'chamar_maria' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{o.acao === 'chamar_maria' ? 'chama a Maria' : 'responde'}</span>
              </div>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{o.resposta}</p>
            </div>
            <div className="flex gap-1 shrink-0 items-center">
              <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!o.ativo} onChange={() => alternar(o)} />ativa</label>
              <button title="Editar" onClick={() => setEdit({ id: o.id, gatilhosTxt: (o.gatilhos || []).join('; '), resposta: o.resposta, acao: o.acao, ativo: o.ativo, ordem: o.ordem })} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"><Pencil size={16} /></button>
              <button title="Excluir" onClick={async () => { if (!confirm('Excluir esta objeção?')) return; try { await api.post({ action: 'objecao_excluir', id: o.id }); await carregar(); } catch (e) { toast.error(e.message); } }} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
            </div>
          </div>
        ))}
        {lista && lista.length === 0 && <div className="p-8 text-center text-slate-500">Nenhuma objeção cadastrada. Use a importação acima.</div>}
      </div>
    </div>
  );
}
