'use client';
// app/admin/bot/componentes/InstanciasPanel.js
// Instâncias WhatsApp reserva (18.2). Só admin. O token fica SÓ no servidor: aqui só
// aparece mascarado (••••abcd); no cadastro/edição o campo é só de escrita.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Aviso, btnAzul, btnCinza, cartao, inputCls, useAoMontar } from './comum';

export default function InstanciasPanel({ api }) {
  const [lista, setLista] = useState(null);
  const [erro, setErro] = useState(null);
  const [form, setForm] = useState(null); // {id?, nome, base_url, token}
  const [testes, setTestes] = useState({});

  const carregar = useCallback(async () => {
    try { setLista(await api.get('instancias')); setErro(null); } catch (e) { setErro(e.message); setLista([]); }
  }, [api]);
  useAoMontar(carregar);

  async function salvar() {
    try { await api.post({ action: 'instancia_salvar', ...form }); toast.success('Instância salva'); setForm(null); await carregar(); }
    catch (e) { toast.error(e.message); }
  }
  async function simples(payload, ok) {
    try { await api.post(payload); toast.success(ok); await carregar(); } catch (e) { toast.error(e.message); }
  }
  async function testar(i) {
    setTestes((t) => ({ ...t, [i.id]: { rodando: true } }));
    try { const r = await api.post({ action: 'instancia_testar', id: i.id }); setTestes((t) => ({ ...t, [i.id]: r.teste })); }
    catch (e) { setTestes((t) => ({ ...t, [i.id]: { ok: false, erro: e.message } })); }
  }

  return (
    <div className={`${cartao} space-y-3`}>
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-slate-800">Instâncias do WhatsApp (números reserva)</h3>
        <button className={btnAzul} onClick={() => setForm({ nome: '', base_url: '', token: '' })}>+ Nova instância</button>
      </div>
      <Aviso tipo="alerta"><b>Atenção:</b> trocar a instância ativa <b>não</b> reconfigura o webhook. O webhook da nova instância precisa ser apontado manualmente para <code>/webhook</code>, com os mesmos eventos e filtros da instância atual (e, se houver grupo de avisos, o número reserva precisa estar no grupo).</Aviso>
      {erro && <Aviso tipo="erro">{erro} (a migração bot-v2 foi aplicada?)</Aviso>}

      {form && (
        <div className="border border-blue-200 rounded-xl p-3 space-y-2">
          <input className={inputCls} placeholder="Nome (ex.: VE-031)" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input className={inputCls} placeholder="base_url (https://…)" value={form.base_url} onChange={(e) => setForm({ ...form, base_url: e.target.value })} />
          <input className={inputCls} type="password" autoComplete="new-password" placeholder={form.id ? 'Token (deixe vazio para manter o atual)' : 'Token da instância'} value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} />
          <div className="flex gap-2"><button className={btnAzul} onClick={salvar}>Salvar</button><button className={btnCinza} onClick={() => setForm(null)}>Cancelar</button></div>
        </div>
      )}

      <div className="divide-y divide-slate-100">
        {(lista || []).map((i) => {
          const t = testes[i.id];
          return (
            <div key={i.id} className="py-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <b className="text-slate-800">{i.nome}</b>
                {i.ativa && <span className="bg-emerald-100 text-emerald-700 text-xs font-bold rounded px-2 py-0.5">ATIVA</span>}
                {i.principal && <span className="bg-blue-100 text-blue-700 text-xs font-bold rounded px-2 py-0.5">principal</span>}
                <span className="text-slate-500 text-xs break-all">{i.base_url}</span>
                <code className="text-xs text-slate-500">token {i.token_mascarado}</code>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button className={btnCinza} onClick={() => testar(i)} disabled={t?.rodando}>{t?.rodando ? 'Testando…' : 'Testar conexão'}</button>
                {!i.ativa && <button className={btnCinza} onClick={() => { if (confirm(`Usar "${i.nome}" como instância do bot? O webhook NÃO será reconfigurado.`)) simples({ action: 'instancia_ativar', id: i.id }, 'Instância ativada'); }}>Usar esta</button>}
                {!i.principal && <button className={btnCinza} onClick={() => simples({ action: 'instancia_principal', id: i.id }, 'Marcada como principal')}>Marcar principal</button>}
                <button className={btnCinza} onClick={() => setForm({ id: i.id, nome: i.nome, base_url: i.base_url, token: '' })}>Editar</button>
                {!i.ativa && <button className="text-red-600 text-sm font-bold px-3" onClick={() => { if (confirm(`Excluir a instância "${i.nome}"?`)) simples({ action: 'instancia_excluir', id: i.id }, 'Excluída'); }}>Excluir</button>}
              </div>
              {t && !t.rodando && (
                <div className={`text-xs rounded-lg p-2 ${t.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                  {t.ok ? `✅ Conectou (HTTP ${t.http}, ${t.ms} ms)` : `❌ Falhou ${t.http ? `(HTTP ${t.http})` : ''}: ${t.erro || ''}`}
                  {t.resposta && <pre className="mt-1 whitespace-pre-wrap break-all">{t.resposta}</pre>}
                </div>
              )}
            </div>
          );
        })}
        {lista && lista.length === 0 && !erro && <div className="py-4 text-sm text-slate-500">Nenhuma instância cadastrada. Sem instância ativa no banco, o bot usa as envs atuais.</div>}
      </div>
    </div>
  );
}
