'use client';
// app/admin/bot/componentes/ControleTab.js
// Central de controle (item 16) — só admin. Todo controle grava em bot_config via
// /api/admin/bot (validação no servidor + auditoria em bot_config_audit).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { Trash2, Plus } from 'lucide-react';
import { Aviso, btnAzul, btnCinza, cartao, fmtData, fmtFone, inputCls } from './comum';
import FormConfig from './FormConfig';
import { ContatoControle } from './ConversasTab';
import InstanciasPanel from './InstanciasPanel';
import { CAMPOS_PRECO } from './ScriptTab';
import { MOTIVOS_AVISO } from '../../../utils/botConfig';

const MODOS = [['off', 'Desligado'], ['test', 'Teste'], ['shadow', 'Sombra'], ['production', 'Produção']];
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

function estadoEfetivo(cfg) {
  const on = cfg.bot_enabled === 'true';
  const modo = cfg.bot_mode || 'off';
  if (!on) return { cor: 'bg-red-600', texto: 'Bot DESLIGADO (kill switch ativo): não responde ninguém.' };
  if (modo === 'off') return { cor: 'bg-slate-700', texto: 'Bot ligado, mas em modo DESLIGADO: não responde ninguém.' };
  if (modo === 'test') return { cor: 'bg-amber-500', texto: `Bot em TESTE: responde só ${cfg.test_numbers || '(nenhum número cadastrado)'}` };
  if (modo === 'shadow') return { cor: 'bg-violet-600', texto: 'Bot em SOMBRA: gera as respostas mas não envia nada ao cliente.' };
  const cid = (cfg.cidades_ativas || '').trim();
  return { cor: 'bg-emerald-600', texto: `Bot em PRODUÇÃO: ${cid ? `responde só em ${cid}; as demais cidades ficam em sombra` : 'nenhuma cidade liberada — tudo fica em sombra'}.` };
}

// ── Janela de atendimento por dia da semana ──
function JanelaEditor({ cfg, onSalvar }) {
  const parse = useCallback(() => {
    try { const o = JSON.parse(cfg.janela_json || ''); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
  }, [cfg.janela_json]);
  const [j, setJ] = useState({ default: ['06:30', '22:00'] });
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o rascunho local com a config recarregada
  useEffect(() => { const o = parse(); setJ({ default: ['06:30', '22:00'], ...o }); }, [parse]);
  const setPar = (k, i, v) => setJ((x) => ({ ...x, [k]: Object.assign([...(x[k] || x.default)], { [i]: v }) }));
  async function salvar() {
    try { await onSalvar([{ key: 'janela_json', value: JSON.stringify(j) }]); toast.success('Janela salva'); } catch (e) { toast.error(e.message); }
  }
  const linha = (k, nome, custom) => (
    <div key={k} className="flex items-center gap-2 text-sm">
      <span className="w-24 font-semibold text-slate-700">{nome}</span>
      {custom && <label className="text-xs flex items-center gap-1"><input type="checkbox" checked={!!j[k]} onChange={(e) => setJ((x) => { const n = { ...x }; if (e.target.checked) n[k] = [...x.default]; else delete n[k]; return n; })} />personalizar</label>}
      {(!custom || j[k]) && (<>
        <input type="time" className="p-2 border border-slate-200 rounded-lg" value={(j[k] || j.default)[0]} onChange={(e) => setPar(k, 0, e.target.value)} />
        <span>até</span>
        <input type="time" className="p-2 border border-slate-200 rounded-lg" value={(j[k] || j.default)[1]} onChange={(e) => setPar(k, 1, e.target.value)} />
      </>)}
    </div>
  );
  return (
    <div className={`${cartao} space-y-2`}>
      <h3 className="font-bold text-slate-800">Janela de atendimento (America/Sao_Paulo)</h3>
      {linha('default', 'Padrão', false)}
      {DIAS.map((d, i) => linha(String(i), d, true))}
      <button className={btnAzul} onClick={salvar}>Salvar janela</button>
    </div>
  );
}

// ── Pausas programadas ──
function PausasEditor({ cfg, onSalvar }) {
  const [lista, setLista] = useState([]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o rascunho local com a config recarregada
  useEffect(() => { try { const o = JSON.parse(cfg.pausas_json || '[]'); setLista(Array.isArray(o) ? o : []); } catch { setLista([]); } }, [cfg.pausas_json]);
  const set = (i, k, v) => setLista((l) => l.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
  async function salvar() {
    try { await onSalvar([{ key: 'pausas_json', value: JSON.stringify(lista.map((p) => ({ de: p.de, ate: p.ate, msg: p.msg || '' }))) }]); toast.success('Pausas salvas'); } catch (e) { toast.error(e.message); }
  }
  return (
    <div className={`${cartao} space-y-2`}>
      <h3 className="font-bold text-slate-800">Pausas programadas</h3>
      <p className="text-xs text-slate-500">Datas em que o bot não responde (feriado, folga). Mensagem opcional enviada nesses dias.</p>
      {lista.map((p, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-center">
          <input type="date" className="p-2 border border-slate-200 rounded-lg" value={p.de || ''} onChange={(e) => set(i, 'de', e.target.value)} />
          <span className="text-sm">até</span>
          <input type="date" className="p-2 border border-slate-200 rounded-lg" value={p.ate || ''} onChange={(e) => set(i, 'ate', e.target.value)} />
          <input className="flex-1 min-w-[200px] p-2 border border-slate-200 rounded-lg text-sm" placeholder="mensagem opcional" value={p.msg || ''} onChange={(e) => set(i, 'msg', e.target.value)} />
          <button className="text-red-500 p-2" onClick={() => setLista((l) => l.filter((_, j) => j !== i))}><Trash2 size={16} /></button>
        </div>
      ))}
      <div className="flex gap-2">
        <button className={btnCinza} onClick={() => setLista((l) => [...l, { de: '', ate: '', msg: '' }])}><Plus size={14} className="inline mr-1" />Adicionar pausa</button>
        <button className={btnAzul} onClick={salvar}>Salvar pausas</button>
      </div>
    </div>
  );
}

// ── Ignorados (com apelido) ──
function IgnoradosEditor({ cfg, onSalvar }) {
  const [itens, setItens] = useState([]);
  const [novo, setNovo] = useState({ numero: '', apelido: '' });
  useEffect(() => {
    let ap = {}; try { ap = JSON.parse(cfg.ignore_apelidos_json || '{}'); } catch { ap = {}; }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o rascunho local com a config recarregada
    setItens((cfg.ignore_numbers || '').split(',').map((x) => x.trim()).filter(Boolean).map((n) => ({ numero: n, apelido: ap[n] || '' })));
  }, [cfg.ignore_numbers, cfg.ignore_apelidos_json]);
  async function salvar(lista) {
    const apelidos = {}; for (const i of lista) if (i.apelido.trim()) apelidos[i.numero] = i.apelido.trim();
    try {
      await onSalvar([{ key: 'ignore_numbers', value: lista.map((i) => i.numero).join(',') }, { key: 'ignore_apelidos_json', value: JSON.stringify(apelidos) }]);
      toast.success('Lista de ignorados salva');
    } catch (e) { toast.error(e.message); }
  }
  function adicionar() {
    const n = novo.numero.replace(/\D/g, '');
    if (n.length < 8) return toast.error('Número inválido (DDI+DDD+número)');
    if (itens.some((i) => i.numero === n)) return toast.error('Já está na lista');
    const l = [...itens, { numero: n, apelido: novo.apelido }]; setItens(l); setNovo({ numero: '', apelido: '' }); salvar(l);
  }
  return (
    <div className={`${cartao} space-y-2`}>
      <h3 className="font-bold text-slate-800">Números ignorados (equipe, fornecedores, família)</h3>
      <p className="text-xs text-slate-500">Nunca tratados como lead. A comparação do bot usa os últimos 8 dígitos. O apelido é só do painel.</p>
      {itens.map((i) => (
        <div key={i.numero} className="flex items-center gap-3 text-sm border-b border-slate-100 pb-1">
          <code>{i.numero}</code><span className="text-slate-600 flex-1">{i.apelido}</span>
          <button className="text-red-500" onClick={() => { const l = itens.filter((x) => x.numero !== i.numero); setItens(l); salvar(l); }}><Trash2 size={15} /></button>
        </div>
      ))}
      <div className="flex gap-2 flex-wrap">
        <input className={`${inputCls} w-56`} placeholder="5531999999999" value={novo.numero} onChange={(e) => setNovo({ ...novo, numero: e.target.value })} />
        <input className={`${inputCls} w-56`} placeholder="apelido (ex.: André instalador)" value={novo.apelido} onChange={(e) => setNovo({ ...novo, apelido: e.target.value })} />
        <button className={btnAzul} onClick={adicionar}>Adicionar</button>
      </div>
    </div>
  );
}

// ── Cidades ativas em produção ──
function CidadesAtivas({ api, cfg, onSalvar }) {
  const [cals, setCals] = useState([]);
  const [sel, setSel] = useState(new Set());
  useEffect(() => { api.get('calendarios').then((l) => setCals(l.map((c) => c.city))).catch(() => {}); }, [api]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o rascunho local com a config recarregada
  useEffect(() => { setSel(new Set((cfg.cidades_ativas || '').split(',').map((x) => x.trim()).filter(Boolean))); }, [cfg.cidades_ativas]);
  const alternar = (c) => setSel((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n; });
  async function salvar() {
    try { await onSalvar([{ key: 'cidades_ativas', value: [...sel].join(',') }]); toast.success('Cidades salvas'); } catch (e) { toast.error(e.message); }
  }
  return (
    <div className={`${cartao} space-y-2`}>
      <h3 className="font-bold text-slate-800">Cidades ativas em produção</h3>
      <p className="text-xs text-slate-500">Só em produção: o bot responde leads destas cidades; as demais ficam em sombra.</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1">
        {cals.map((c) => <label key={c} className="text-sm flex items-center gap-2"><input type="checkbox" checked={sel.has(c)} onChange={() => alternar(c)} />{c}</label>)}
      </div>
      <button className={btnAzul} onClick={salvar}>Salvar cidades</button>
    </div>
  );
}

function CustoSaude({ api }) {
  const [custo, setCusto] = useState(null);
  const [saude, setSaude] = useState(null);
  const [erro, setErro] = useState(null);
  useEffect(() => {
    api.get('custo').then(setCusto).catch((e) => setErro(e.message));
    api.get('saude').then(setSaude).catch((e) => setErro(e.message));
  }, [api]);
  const brl = (v) => (v == null ? '—' : `R$ ${v.toFixed(2).replace('.', ',')}`);
  const pct = (v, t) => (v != null && t ? ` (${Math.round((v / t) * 100)}% do teto)` : '');
  return (
    <div className={`${cartao} space-y-2 text-sm`}>
      <h3 className="font-bold text-slate-800">Gasto de IA e saúde</h3>
      {erro && <Aviso tipo="alerta">Sem dados de custo/saúde ainda ({erro}).</Aviso>}
      {custo && (
        <div>Hoje: <b>{brl(custo.dia_brl)}</b>{pct(custo.dia_brl, custo.teto_dia_brl)} · Mês: <b>{brl(custo.mes_brl)}</b>{pct(custo.mes_brl, custo.teto_mes_brl)} · {custo.chamadas_mes} chamada(s) no mês
          {!custo.usd_brl && <span className="text-amber-600"> · defina <code>usd_brl</code> para converter em R$</span>}</div>
      )}
      {saude && (
        <div>Último webhook: <b>{fmtData(saude.ultimo_webhook)}</b> · Último envio: <b>{fmtData(saude.ultimo_envio)}</b> · Erros de IA (24h): <b>{saude.erros_ia_24h ?? '—'}</b></div>
      )}
      <p className="text-xs text-slate-400">Depende de o bot registrar eventos <code>custo</code>/<code>webhook</code>/<code>envio</code>/<code>erro_ia</code> em <code>bot_events</code>. Status de Zaptos/GHL/OpenRouter (verde/vermelho) não está neste painel.</p>
    </div>
  );
}

function Auditoria({ api, versao }) {
  const [lista, setLista] = useState(null);
  useEffect(() => { api.get('auditoria').then(setLista).catch(() => setLista([])); }, [api, versao]);
  return (
    <div className={`${cartao} space-y-2`}>
      <h3 className="font-bold text-slate-800">Auditoria de alterações (últimas 100)</h3>
      <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 text-xs">
        {(lista || []).map((a) => (
          <div key={a.id} className="py-1.5 grid grid-cols-[110px_1fr] gap-2">
            <span className="text-slate-400">{fmtData(a.created_at)}</span>
            <span><b>{a.quem || '?'}</b> alterou <code>{a.chave}</code>: <span className="text-red-600 break-all">{(a.valor_antigo ?? '∅').slice(0, 80)}</span> → <span className="text-emerald-700 break-all">{(a.valor_novo ?? '∅').slice(0, 80)}</span></span>
          </div>
        ))}
        {lista && lista.length === 0 && <div className="py-4 text-slate-500">Nenhuma alteração registrada.</div>}
      </div>
    </div>
  );
}

export default function ControleTab({ api, config, papel }) {
  const { cfg, erro, salvar } = config;
  const [versao, setVersao] = useState(0);
  const salvarEAudit = useCallback(async (p) => { const r = await salvar(p); setVersao((v) => v + 1); return r; }, [salvar]);

  const camposToggle = useMemo(() => MOTIVOS_AVISO.map(([m, r]) => ({ k: `aviso_toggle_${m}`, rotulo: r, tipo: 'bool' })), []);
  const padroesToggle = useMemo(() => Object.fromEntries(MOTIVOS_AVISO.map(([m]) => [`aviso_toggle_${m}`, 'true'])), []);

  if (erro) return <Aviso tipo="erro">Não consegui carregar a configuração: {erro}</Aviso>;
  if (!cfg) return <div className="text-slate-400 text-sm">Carregando…</div>;
  const st = estadoEfetivo(cfg);

  return (
    <div className="space-y-6">
      <div className={`${st.cor} text-white rounded-2xl p-4 font-bold`}>{st.texto}
        <div className="text-xs font-normal opacity-80 mt-1">Este é o estado gravado no painel. As variáveis de ambiente do bot (BOT_ENABLED, BOT_MODE, BOT_ALLOWED_NUMBERS) vencem quando são mais restritivas — o painel não consegue destravar o que a env trava. Mudanças valem em até 60 s.</div>
      </div>

      <FormConfig titulo="Ligar e modo" cfg={cfg} onSalvar={salvarEAudit} campos={[
        { k: 'bot_enabled', rotulo: 'Bot ligado (kill switch)', tipo: 'bool', dica: 'Desmarcado = não responde ninguém. O botão vermelho PARAR TUDO faz isso com 1 clique.' },
        { k: 'bot_mode', rotulo: 'Modo', tipo: 'select', opcoes: MODOS },
        { k: 'test_numbers', rotulo: 'Números de teste (modo teste)', tipo: 'texto', largo: true, dica: 'Só dígitos com DDI+DDD, separados por vírgula. Ex.: 553195079085' },
        { k: 'admin_numbers', rotulo: 'Números admin (comandos #bot …)', tipo: 'texto', largo: true, dica: 'Só estes números podem mandar #bot off / on / status / pausar. Nunca são tratados como lead.' },
      ]} />

      <CidadesAtivas api={api} cfg={cfg} onSalvar={salvarEAudit} />
      <IgnoradosEditor cfg={cfg} onSalvar={salvarEAudit} />
      <ContatoControle api={api} papel={papel} />

      <h2 className="text-lg font-black text-slate-800 pt-2">Horário e ritmo</h2>
      <JanelaEditor cfg={cfg} onSalvar={salvarEAudit} />
      <PausasEditor cfg={cfg} onSalvar={salvarEAudit} />
      <FormConfig titulo="Tempos" cfg={cfg} onSalvar={salvarEAudit} campos={[
        { k: 'delay_digit_min_s', rotulo: 'Delay mínimo de digitação (s)', tipo: 'numero' },
        { k: 'delay_digit_max_s', rotulo: 'Delay máximo de digitação (s)', tipo: 'numero' },
        { k: 'debounce_s', rotulo: 'Debounce de mensagens seguidas (s)', tipo: 'numero' },
        { k: 'lead_novo_espera_min', rotulo: 'Espera do lead novo (min)', tipo: 'numero' },
        { k: 'intervalo_fotos_s', rotulo: 'Intervalo entre fotos (s)', tipo: 'numero' },
        { k: 'humano_cooldown_h', rotulo: 'Pausa quando humano responde (h)', tipo: 'numero' },
        { k: 'followup_horas', rotulo: 'Follow-up após (h)', tipo: 'numero' },
        { k: 'followup_max', rotulo: 'Follow-ups no máximo (0–2)', tipo: 'numero' },
      ]} />

      <h2 className="text-lg font-black text-slate-800 pt-2">Notificações</h2>
      <FormConfig titulo="Destinos e horários dos avisos" cfg={cfg} onSalvar={salvarEAudit} campos={[
        { k: 'handoff_destinos', rotulo: 'Destinos dos avisos de handoff', tipo: 'texto', largo: true, dica: 'Números (só dígitos) e/ou JIDs de grupo (…@g.us), separados por vírgula.' },
        { k: 'aviso_limite_h', rotulo: 'Avisos em tempo real até', tipo: 'hora' },
        { k: 'resumo_manha_h', rotulo: 'Resumo da manhã', tipo: 'hora' },
        { k: 'relatorio_destinos', rotulo: 'Relatório diário — destinatários', tipo: 'texto', largo: true },
        { k: 'relatorio_h', rotulo: 'Relatório diário — horário', tipo: 'hora' },
      ]} extra={(
        <div className="flex gap-2 flex-wrap">
          <button className={btnCinza} disabled title="Precisa de um endpoint no bot (PR 1) para enviar uma mensagem de teste. Ainda não existe no contrato.">Enviar teste (indisponível)</button>
          <button className={btnCinza} disabled title="Precisa de um endpoint no bot (PR 1) para disparar o relatório. Ainda não existe no contrato.">Enviar relatório agora (indisponível)</button>
        </div>
      )} />
      <FormConfig titulo="Motivos que geram aviso" descricao="Desligado = o aviso é registrado como suprimido_toggle na aba Avisos e não é enviado. 'Guardrail' cobre manipulação, dados de terceiros, conteúdo ofensivo e bloqueios do filtro de saída (item 20.5)."
        campos={camposToggle} padroes={padroesToggle} cfg={cfg} onSalvar={salvarEAudit} />

      <h2 className="text-lg font-black text-slate-800 pt-2">Regras do negócio</h2>
      <FormConfig titulo="Preços e duração" cfg={cfg} onSalvar={salvarEAudit} campos={CAMPOS_PRECO} />
      <FormConfig titulo="Agenda" cfg={cfg} onSalvar={salvarEAudit} campos={[
        { k: 'grade_horarios', rotulo: 'Grade de horários', tipo: 'texto', largo: true, dica: 'HH:MM separados por vírgula. O último horário por cidade fica na aba Agenda.' },
        { k: 'ultimo_horario_sabado', rotulo: 'Último horário de sábado', tipo: 'hora' },
        { k: 'aviso_cima_hora_min', rotulo: 'Aviso de agendamento com menos de (min)', tipo: 'numero' },
        { k: 'raio_km', rotulo: 'Raio da cidade vizinha (km)', tipo: 'numero' },
        { k: 'almoco_regra', rotulo: 'Regra do almoço ligada', tipo: 'bool' },
      ]} />
      <FormConfig titulo="Mídia" cfg={cfg} onSalvar={salvarEAudit} campos={[
        { k: 'audio_transcricao', rotulo: 'Transcrição de áudio ligada', tipo: 'bool' },
        { k: 'foto_modo', rotulo: 'Comportamento com foto do cliente', tipo: 'select', opcoes: [['chamar_maria', 'Sempre chamar a Maria'], ['analisar', 'Analisar (exige modelo com visão)']] },
        { k: 'max_fotos', rotulo: 'Máximo de fotos por envio', tipo: 'numero' },
        { k: 'max_chars_resposta', rotulo: 'Máx. de caracteres da resposta', tipo: 'numero' },
        { k: 'texto_fotos_marca', rotulo: 'Texto das fotos da marca', tipo: 'area', dica: 'Use {marca}. Ex.: "Esses são alguns volantes da {marca} que já revestimos…"' },
        { k: 'texto_fora_escopo', rotulo: 'Resposta fixa fora do escopo / guardrail', tipo: 'area' },
      ]} />
      <FormConfig titulo="Persona e pagamento" cfg={cfg} onSalvar={salvarEAudit} campos={[
        { k: 'persona_nome', rotulo: 'Nome da persona (vazio = "equipe Volante Express")', tipo: 'texto' },
        { k: 'persona_emojis', rotulo: 'Emojis', tipo: 'select', opcoes: [['nenhum', 'Nenhum'], ['pouco', 'Pouco'], ['normal', 'Normal']] },
        { k: 'pix_chave', rotulo: 'Chave Pix (enviada só se o cliente insistir)', tipo: 'texto' },
      ]} />

      <h2 className="text-lg font-black text-slate-800 pt-2">IA, custo e saúde</h2>
      <FormConfig titulo="Modelo e tetos" cfg={cfg} onSalvar={salvarEAudit} campos={[
        { k: 'ia_modelo', rotulo: 'Modelo principal (slug do OpenRouter)', tipo: 'texto', dica: 'Confirme o slug exato na lista do OpenRouter antes de salvar.' },
        { k: 'ia_modelo_fallback', rotulo: 'Modelo de fallback', tipo: 'texto' },
        { k: 'usd_brl', rotulo: 'Câmbio USD → BRL', tipo: 'texto' },
        { k: 'ia_teto_dia_brl', rotulo: 'Teto diário (R$)', tipo: 'texto' },
        { k: 'ia_teto_mes_brl', rotulo: 'Teto mensal (R$)', tipo: 'texto' },
        { k: 'shadow_max_dia', rotulo: 'Máx. de chamadas de IA/dia em sombra', tipo: 'numero' },
      ]} />
      <CustoSaude api={api} />

      <InstanciasPanel api={api} />
      <Auditoria api={api} versao={versao} />
    </div>
  );
}
