'use client';
// app/admin/bot/componentes/AgendaTab.js
// Agenda (datas por texto + endereço do GHL somente leitura + maps_url + último horário).
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Aviso, btnAzul, cartao, inputCls } from './comum';

// Extrai coordenadas de "lat,lng" ou de links com @lat,lng (links curtos não dá no navegador).
function coordsDe(url) {
  const t = String(url || '').trim();
  let m = t.match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if (!m) m = t.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/) || t.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  return m ? `${m[1]}, ${m[2]}` : null;
}
// Endereço "vago": sem número (ex.: "Estacionamento do Econormart").
const enderecoVago = (e) => !/\d/.test(e || '');

function LinhaCidade({ c, onSalvo, api }) {
  const [maps, setMaps] = useState(c.maps_url || '');
  const [ultimo, setUltimo] = useState(c.ultimo_horario || '');
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { setMaps(c.maps_url || ''); setUltimo(c.ultimo_horario || ''); }, [c.maps_url, c.ultimo_horario]);
  const sujo = maps !== (c.maps_url || '') || ultimo !== (c.ultimo_horario || '');
  const ds = Array.isArray(c.attendance_dates) && c.attendance_dates.length
    ? c.attendance_dates.map((d) => d.slice(8, 10) + '/' + d.slice(5, 7)).join(', ')
    : (c.attendance_date ? c.attendance_date.slice(8, 10) + '/' + c.attendance_date.slice(5, 7) : null);
  const semEndereco = !c.endereco_ghl;
  const vago = c.endereco_ghl && enderecoVago(c.endereco_ghl);
  const semPin = !c.maps_url;

  async function salvar() {
    setSalvando(true);
    try { await api.post({ action: 'save_calendario', city: c.city, maps_url: maps, ultimo_horario: ultimo }); toast.success(`${c.city} salvo`); await onSalvo(); }
    catch (e) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  return (
    <div className={`border rounded-xl p-3 space-y-2 ${semEndereco ? 'border-red-200 bg-red-50/40' : vago || semPin ? 'border-amber-200 bg-amber-50/40' : 'border-slate-100'}`}>
      <div className="flex justify-between gap-3 text-sm">
        <span className="font-bold text-slate-800">{c.city}</span>
        <span className={'font-mono text-right ' + (ds ? 'text-emerald-600' : 'text-slate-400')}>{ds || 'sem data'}</span>
      </div>
      <div className="text-xs">
        <span className="text-slate-500">Endereço no GHL (somente leitura): </span>
        {semEndereco ? <b className="text-red-600">sem endereço no calendário do GHL</b> : <span className="text-slate-700">{c.endereco_ghl}</span>}
        {vago && <b className="text-amber-600"> · endereço vago (sem número)</b>}
      </div>
      <div className="flex flex-col md:flex-row gap-2">
        <div className="flex-1">
          <input className={inputCls} placeholder="maps_url — link do Google Maps ou lat,lng" value={maps} onChange={(e) => setMaps(e.target.value)} />
          <p className="text-[11px] mt-0.5 text-slate-400">
            {semPin ? <b className="text-amber-600">sem pin — o bot manda só o endereço em texto. </b> : null}
            {coordsDe(maps) ? `coordenadas: ${coordsDe(maps)}` : maps ? 'link curto/sem coordenadas visíveis: o bot extrai no servidor' : ''}
          </p>
        </div>
        <div className="md:w-40">
          <input className={inputCls} type="time" value={ultimo} onChange={(e) => setUltimo(e.target.value)} title="Último horário desta cidade (override). Vazio = grade padrão" />
          <p className="text-[11px] mt-0.5 text-slate-400">último horário (ex.: 16:45)</p>
        </div>
        <button className={btnAzul} disabled={!sujo || salvando} onClick={salvar}>Salvar</button>
      </div>
    </div>
  );
}

export default function AgendaTab({ api }) {
  const [cals, setCals] = useState(null);
  const [texto, setTexto] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [resultado, setResultado] = useState('');
  const [ghlOk, setGhlOk] = useState(true);

  const carregar = useCallback(async () => {
    try { setCals(await api.get('calendarios')); } catch (e) { toast.error(e.message); setCals([]); }
  }, [api]);
  useEffect(() => { carregar(); api.get('me').then((m) => setGhlOk(!!m.ghl)).catch(() => {}); }, [api, carregar]);

  async function salvarAgenda() {
    if (!texto.trim()) return toast.error('Cole a agenda primeiro');
    setSalvando(true); setResultado('');
    try {
      const r = await api.post({ action: 'save_agenda', texto });
      const partes = [`${r.aplicados.length} cidade(s) atualizada(s)`];
      if (r.naoEncontrados.length) partes.push(`não encontradas: ${r.naoEncontrados.join(' | ')}`);
      if (r.invalidas.length) partes.push(`linhas inválidas: ${r.invalidas.join(' | ')}`);
      setResultado(partes.join(' — ')); toast.success('Agenda salva!'); setTexto(''); await carregar();
    } catch (e) { toast.error(e.message); }
    finally { setSalvando(false); }
  }

  const semEnd = (cals || []).filter((c) => !c.endereco_ghl).length;
  const semPin = (cals || []).filter((c) => !c.maps_url).length;

  return (
    <div className="space-y-4">
      <div className={cartao}>
        <h3 className="font-bold text-slate-800 mb-1">Agenda das regionais</h3>
        <p className="text-xs text-slate-500 mb-3">Cole <b>uma linha por data</b>, no formato <b>Cidade dd/mm</b> (ex.: <code>Divinópolis 05/12</code>). A <b>mesma cidade pode ter várias datas</b> — todas são guardadas. Também aceita <code>dd/mm/aaaa</code>.</p>
        <textarea className={`${inputCls} h-40 font-mono`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'Divinópolis 27/11\nSete Lagoas 26/11\nPedro Leopoldo 30/11'} />
        <div className="flex flex-wrap gap-3 mt-3 items-center">
          <button onClick={salvarAgenda} disabled={salvando} className={btnAzul}>{salvando ? 'Salvando…' : 'Salvar agenda'}</button>
          {resultado && <div className="text-xs text-slate-600">{resultado}</div>}
        </div>
      </div>

      {!ghlOk && <Aviso tipo="alerta">GHL não configurado no servidor do painel (GHL_API_KEY / GHL_LOCATION_ID): os endereços não aparecem.</Aviso>}
      {cals && (semEnd > 0 || semPin > 0) && ghlOk && <Aviso tipo="alerta">{semEnd} cidade(s) sem endereço no GHL · {semPin} cidade(s) sem pin (maps_url). Destacadas abaixo.</Aviso>}

      <div className={cartao}>
        <h3 className="font-bold text-slate-800 mb-3">Cidades ({(cals || []).filter((c) => (Array.isArray(c.attendance_dates) && c.attendance_dates.length) || c.attendance_date).length}/{cals?.length ?? '…'} com data)</h3>
        <div className="grid lg:grid-cols-2 gap-3">
          {(cals || []).map((c) => <LinhaCidade key={c.city} c={c} api={api} onSalvo={carregar} />)}
        </div>
        {!cals && <div className="text-slate-400 text-sm">Carregando…</div>}
      </div>
    </div>
  );
}
