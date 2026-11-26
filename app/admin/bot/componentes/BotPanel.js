'use client';
// app/admin/bot/componentes/BotPanel.js
// Painel do bot: subabas por papel + botão PARAR TUDO fixo no topo (admin).
// Operador só vê: Conversas, Sugestões, Sombra, Avisos, FAQ, Objeções — e o servidor
// recusa (403) qualquer outra coisa, mesmo que alguém force a chamada.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { OctagonX } from 'lucide-react';
import { Aviso, btnCinza, fmtData, useBotApi } from './comum';
import { useConfig } from './FormConfig';
import ControleTab from './ControleTab';
import ScriptTab from './ScriptTab';
import { FaqTab, ObjecoesTab } from './FaqObjecoesTabs';
import { SugestoesTab, SombraTab, AvisosTab } from './RevisaoTabs';
import AgendaTab from './AgendaTab';
import { ConversasTab, SimuladorTab } from './ConversasTab';

const ABAS = {
  controle: ['Controle', ['admin']],
  script: ['Script', ['admin']],
  faq: ['FAQ', ['admin', 'operador']],
  objecoes: ['Objeções', ['admin', 'operador']],
  sugestoes: ['Sugestões', ['admin', 'operador']],
  sombra: ['Sombra', ['admin', 'operador']],
  avisos: ['Avisos', ['admin', 'operador']],
  agenda: ['Agenda', ['admin']],
  simulador: ['Simulador', ['admin']],
  conversas: ['Conversas', ['admin', 'operador']],
};

function BotaoPararTudo({ api, ligado, onMudou }) {
  const [aberto, setAberto] = useState(false);
  const [parada, setParada] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const carregar = useCallback(() => { api.get('parada').then(setParada).catch(() => {}); }, [api]);
  useEffect(() => { carregar(); }, [carregar, ligado]);

  async function confirmar() {
    setOcupado(true);
    try { await api.post({ action: 'parar_tudo' }); toast.success('Bot DESLIGADO (bot_enabled=false)'); setAberto(false); carregar(); onMudou(); }
    catch (e) { toast.error(e.message); }
    finally { setOcupado(false); }
  }
  const desligado = parada?.valor_novo === 'false' && ligado === false;
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setAberto(true)} className="bg-red-600 hover:bg-red-700 text-white font-black py-2.5 px-5 rounded-xl text-sm shadow-lg flex items-center gap-2">
          <OctagonX size={18} /> PARAR TUDO
        </button>
        {desligado && parada && <span className="text-xs text-red-700 font-semibold">Desligado por {parada.quem || '?'} em {fmtData(parada.created_at)}</span>}
      </div>
      {aberto && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-lg font-black text-red-700">Parar o bot agora?</h3>
            <p className="text-sm text-slate-600">Isso grava <code>bot_enabled=false</code>: o bot para de responder todo mundo em até 60 s. Para religar é preciso marcar o kill switch na aba Controle.</p>
            <div className="flex gap-3 justify-end">
              <button className={btnCinza} onClick={() => setAberto(false)} disabled={ocupado}>Cancelar</button>
              <button className="bg-red-600 text-white font-black py-2 px-5 rounded-xl text-sm hover:bg-red-700 disabled:opacity-50" onClick={confirmar} disabled={ocupado}>{ocupado ? 'Parando…' : 'Sim, PARAR TUDO'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function BotPanel() {
  const api = useBotApi();
  const [me, setMe] = useState(null);
  const [erro, setErro] = useState(null);
  const [aba, setAba] = useState(null);

  useEffect(() => {
    api.get('me').then((m) => { setMe(m); setAba((a) => a || (m.papel === 'admin' ? 'controle' : 'conversas')); })
      .catch((e) => setErro(e.message));
  }, [api]);

  const config = useConfig(api, me?.papel === 'admin');

  if (erro) return <Aviso tipo="erro">Sem acesso ao painel do bot: {erro}</Aviso>;
  if (!me) return <div className="text-slate-400 text-sm">Carregando painel do bot…</div>;

  const abas = Object.entries(ABAS).filter(([, [, papeis]]) => papeis.includes(me.papel));
  const ligado = config.cfg ? config.cfg.bot_enabled === 'true' : null;

  return (
    <div className="space-y-5">
      <div className="sticky top-0 z-30 -mx-1 px-1 py-2 bg-white/95 backdrop-blur border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Bot AI</h2>
          <p className="text-xs text-slate-500">{me.email} · papel: <b>{me.papel}</b></p>
        </div>
        {me.papel === 'admin' && <BotaoPararTudo api={api} ligado={ligado} onMudou={config.carregar} />}
      </div>

      <div className="flex overflow-x-auto gap-2 bg-slate-100 p-1 rounded-xl">
        {abas.map(([id, [nome]]) => (
          <button key={id} onClick={() => setAba(id)} className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${aba === id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>{nome}</button>
        ))}
      </div>

      {aba === 'controle' && <ControleTab api={api} config={config} papel={me.papel} />}
      {aba === 'script' && <ScriptTab api={api} config={config} />}
      {aba === 'faq' && <FaqTab api={api} />}
      {aba === 'objecoes' && <ObjecoesTab api={api} />}
      {aba === 'sugestoes' && <SugestoesTab api={api} />}
      {aba === 'sombra' && <SombraTab api={api} />}
      {aba === 'avisos' && <AvisosTab api={api} />}
      {aba === 'agenda' && <AgendaTab api={api} />}
      {aba === 'simulador' && <SimuladorTab api={api} />}
      {aba === 'conversas' && <ConversasTab api={api} papel={me.papel} />}
    </div>
  );
}
