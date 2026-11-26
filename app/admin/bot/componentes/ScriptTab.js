'use client';
// app/admin/bot/componentes/ScriptTab.js
// Script do bot: prompt_script, prompt_material, textos fixos e Preços (item 8 / 12).
import { useEffect, useMemo, useState } from 'react';
import { Aviso, cartao, inputCls } from './comum';
import FormConfig from './FormConfig';

export const VARIAVEIS = [
  ['{city}', 'cidade'], ['{date}', 'data do atendimento'], ['{local}', 'endereço do local (GHL)'],
  ['{preco_pix}', 'preço Pix/dinheiro'], ['{preco_cartao}', 'preço cartão'],
];

export function aplicarVariaveis(texto, v) {
  return String(texto || '')
    .replace(/\{city\}/g, v.city).replace(/\{date\}/g, v.date).replace(/\{local\}/g, v.local)
    .replace(/\{preco_pix\}/g, v.preco_pix).replace(/\{preco_cartao\}/g, v.preco_cartao);
}

const proximaData = (c) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const lista = Array.isArray(c?.attendance_dates) && c.attendance_dates.length ? c.attendance_dates : (c?.attendance_date ? [c.attendance_date] : []);
  const d = lista.filter((x) => /^\d{4}-\d{2}-\d{2}/.test(x)).sort().find((x) => x >= hoje) || lista[lista.length - 1];
  return d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '(sem data)';
};

export const CAMPOS_PRECO = [
  { k: 'preco_leve_pix', rotulo: 'Linha leve — Pix/dinheiro (R$)', tipo: 'texto', dica: 'Carro, pickup, SUV, van.' },
  { k: 'preco_leve_cartao', rotulo: 'Linha leve — cartão (R$)', tipo: 'texto' },
  { k: 'preco_pesado_pix', rotulo: 'Linha pesada — Pix/dinheiro (R$)', tipo: 'texto', dica: 'Caminhão e ônibus.' },
  { k: 'preco_pesado_cartao', rotulo: 'Linha pesada — cartão (R$)', tipo: 'texto' },
  { k: 'duracao_min', rotulo: 'Duração do serviço (min)', tipo: 'numero', min: 10, max: 240 },
];

const textosCampos = [
  { k: 'prompt_script', rotulo: 'Prompt do script (prompt_script)', tipo: 'area', alto: 'h-64', dica: 'Instruções principais do bot. Lido pelo bot a cada ≤60 s. Não pode ficar vazio.' },
  { k: 'prompt_material', rotulo: 'Prompt de material (prompt_material)', tipo: 'area', alto: 'h-40', dica: 'Material de apoio injetado no prompt. Não pode ficar vazio.' },
  { k: 'photo_caption', rotulo: 'Texto das fotos (photo_caption)', tipo: 'area', dica: 'Enviado junto das fotos do catálogo.' },
  { k: 'scarcity_text', rotulo: 'Texto de escassez (scarcity_text)', tipo: 'area', dica: 'Usa {city} e {date}.' },
  { k: 'info_text', rotulo: 'Informações do serviço (info_text)', tipo: 'area', alto: 'h-32', dica: 'Usa {local}, {preco_pix}, {preco_cartao}.' },
  { k: 'closing_text', rotulo: 'Texto de fechamento (closing_text)', tipo: 'area', dica: 'Ex.: "Fica melhor agendar de manhã ou de tarde?"' },
];

export default function ScriptTab({ api, config }) {
  const { cfg, erro, salvar } = config;
  const [cals, setCals] = useState([]);
  const [cidade, setCidade] = useState('');
  useEffect(() => {
    api.get('calendarios').then((l) => { setCals(l); setCidade((c) => c || l.find((x) => x.endereco_ghl)?.city || l[0]?.city || ''); }).catch(() => {});
  }, [api]);

  const cal = cals.find((c) => c.city === cidade);
  const vars = useMemo(() => ({
    city: cidade || '(cidade)', date: proximaData(cal), local: cal?.endereco_ghl || '(sem endereço no GHL)',
    preco_pix: cfg?.preco_leve_pix || '149', preco_cartao: cfg?.preco_leve_cartao || '160',
  }), [cidade, cal, cfg]);

  if (erro) return <Aviso tipo="erro">Não consegui carregar a configuração: {erro}</Aviso>;
  if (!cfg) return <div className="text-slate-400 text-sm">Carregando…</div>;

  return (
    <div className="space-y-6">
      <div className={`${cartao} space-y-3`}>
        <h3 className="font-bold text-slate-800">Variáveis disponíveis</h3>
        <div className="flex flex-wrap gap-2">
          {VARIAVEIS.map(([v, d]) => (
            <span key={v} className="text-xs bg-slate-100 rounded-lg px-2.5 py-1.5"><code className="font-bold text-blue-700">{v}</code> <span className="text-slate-500">{d}</span></span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-semibold text-slate-700">Preview com a cidade:</label>
          <select className={`${inputCls} md:w-72`} value={cidade} onChange={(e) => setCidade(e.target.value)}>
            {cals.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
          </select>
          <span className="text-xs text-slate-500">data {vars.date} · local {vars.local} · Pix R$ {vars.preco_pix} · cartão R$ {vars.preco_cartao}</span>
        </div>
      </div>

      <FormConfig titulo="Preços" descricao="Os 4 valores e a duração usados pelo bot ({preco_pix} / {preco_cartao} saem da categoria leve ou pesada)."
        campos={CAMPOS_PRECO} cfg={cfg} onSalvar={salvar} />

      <FormConfig titulo="Textos e prompts" campos={textosCampos} cfg={cfg} onSalvar={salvar}
        extra={(
          <details className="text-sm">
            <summary className="cursor-pointer font-bold text-slate-700">Preview dos textos com a cidade escolhida</summary>
            <div className="mt-3 space-y-3">
              {['scarcity_text', 'info_text', 'closing_text', 'photo_caption', 'prompt_material'].map((k) => (
                <div key={k} className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-blue-900 whitespace-pre-wrap">
                  <b className="text-xs font-mono">{k}</b><br />{aplicarVariaveis(cfg[k], vars) || <i className="text-blue-400">(vazio — o bot usa o padrão do código)</i>}
                </div>
              ))}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-blue-900 whitespace-pre-wrap max-h-60 overflow-y-auto">
                <b className="text-xs font-mono">prompt_script</b><br />{aplicarVariaveis(cfg.prompt_script, vars) || <i className="text-blue-400">(vazio — o bot usa o padrão do código)</i>}
              </div>
              <p className="text-xs text-slate-500">O preview mostra os valores salvos no banco; salve para atualizar. Se um texto estiver vazio, o painel não consegue exibir o padrão que está no código do bot.</p>
            </div>
          </details>
        )} />
    </div>
  );
}
