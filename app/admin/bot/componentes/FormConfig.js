'use client';
// app/admin/bot/componentes/FormConfig.js
// Formulário genérico para chaves de bot_config. Envia SÓ o que mudou; o servidor valida
// cada chave (botConfig.js) e grava a auditoria (bot_config_audit).
import { useEffect, useMemo, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { btnAzul, cartao, inputCls, useAoMontar } from './comum';

// Hook: carrega bot_config (admin) e expõe salvar(payload).
export function useConfig(api, habilitado = true) {
  const [cfg, setCfg] = useState(null);
  const [erro, setErro] = useState(null);
  const carregar = useCallback(async () => {
    if (!habilitado) return; // operador não lê bot_config
    try {
      const lista = await api.get('config');
      setCfg(Object.fromEntries(lista.map((r) => [r.key, r.value])));
      setErro(null);
    } catch (e) { setErro(e.message); }
  }, [api, habilitado]);
  useAoMontar(carregar);
  const salvar = useCallback(async (payload) => {
    const r = await api.post({ action: 'save_config', payload });
    if (r.auditoria) toast.error(r.auditoria);
    await carregar();
    return r;
  }, [api, carregar]);
  return { cfg, erro, carregar, salvar };
}

export default function FormConfig({ titulo, descricao, campos, cfg, onSalvar, extra, padroes = {} }) {
  const inicial = useMemo(() => {
    const o = {};
    for (const c of campos) o[c.k] = cfg?.[c.k] ?? padroes[c.k] ?? '';
    return o;
  }, [campos, cfg, padroes]);
  const [draft, setDraft] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setDraft(inicial); }, [inicial]);

  const sujos = campos.filter((c) => (draft[c.k] ?? '') !== (inicial[c.k] ?? ''));

  async function salvar() {
    if (!sujos.length) return;
    setSalvando(true);
    try {
      await onSalvar(sujos.map((c) => ({ key: c.k, value: String(draft[c.k] ?? '') })));
      toast.success('Salvo!');
    } catch (e) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className={`${cartao} space-y-4`}>
      {(titulo || descricao) && (
        <div>
          {titulo && <h3 className="font-bold text-slate-800">{titulo}</h3>}
          {descricao && <p className="text-xs text-slate-500 mt-0.5">{descricao}</p>}
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {campos.map((c) => (
          <div key={c.k} className={c.tipo === 'area' || c.largo ? 'md:col-span-2 space-y-1' : 'space-y-1'}>
            {c.tipo === 'bool' ? (
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                <input type="checkbox" checked={String(draft[c.k]) === 'true'} onChange={(e) => set(c.k, e.target.checked ? 'true' : 'false')} />
                {c.rotulo}
              </label>
            ) : (
              <>
                <label className="block text-sm font-bold text-slate-700">{c.rotulo}</label>
                {c.tipo === 'area' ? (
                  <textarea className={`${inputCls} ${c.alto || 'h-28'} font-mono`} value={draft[c.k] ?? ''} onChange={(e) => set(c.k, e.target.value)} placeholder={c.placeholder} />
                ) : c.tipo === 'select' ? (
                  <select className={inputCls} value={draft[c.k] ?? ''} onChange={(e) => set(c.k, e.target.value)}>
                    {!c.opcoes.some(([v]) => v === (draft[c.k] ?? '')) && <option value={draft[c.k] ?? ''}>{draft[c.k] ? `${draft[c.k]} (atual)` : '— escolha —'}</option>}
                    {c.opcoes.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                ) : (
                  <input className={inputCls} type={c.tipo === 'numero' ? 'number' : c.tipo === 'hora' ? 'time' : 'text'} step={c.passo} min={c.min} max={c.max}
                    value={draft[c.k] ?? ''} onChange={(e) => set(c.k, e.target.value)} placeholder={c.placeholder} />
                )}
              </>
            )}
            {c.dica && <p className="text-xs text-slate-500">{c.dica}</p>}
            <p className="text-[10px] font-mono text-slate-400">{c.k}</p>
          </div>
        ))}
      </div>
      {extra}
      <button onClick={salvar} disabled={salvando || !sujos.length} className={btnAzul}>
        {salvando ? 'Salvando…' : sujos.length ? `Salvar (${sujos.length})` : 'Sem alterações'}
      </button>
    </div>
  );
}
