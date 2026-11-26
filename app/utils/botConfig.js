// app/utils/botConfig.js
// Contrato de chaves de bot_config (key/value TEXTO) entre o painel e o bot.
// Fonte: docs/bot-config-keys.md do repo whatsapp-bot-volante.
// Cada chave tem um validador que normaliza o valor (string) ou lança Error.
// Roda no SERVIDOR: nada do que o navegador manda é gravado sem passar por aqui.

const falha = (msg) => { throw new Error(msg); };

const bool = (v) => {
  const t = String(v).trim().toLowerCase();
  if (t !== 'true' && t !== 'false') falha('esperado "true" ou "false"');
  return t;
};
const inteiro = (min, max) => (v) => {
  const t = String(v).trim();
  if (!/^\d+$/.test(t)) falha('esperado número inteiro');
  const n = Number(t);
  if (n < min || n > max) falha(`deve estar entre ${min} e ${max}`);
  return String(n);
};
const decimal = (min, max) => (v) => {
  const t = String(v).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) falha('esperado número (ex.: 149 ou 149.90)');
  const n = Number(t);
  if (n < min || n > max) falha(`deve estar entre ${min} e ${max}`);
  return t;
};
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const hora = (v) => {
  const t = String(v).trim();
  if (!HHMM.test(t)) falha('esperado horário HH:MM');
  return t;
};
const texto = (max, { obrigatorio = false } = {}) => (v) => {
  const t = String(v);
  if (obrigatorio && !t.trim()) falha('não pode ficar vazio');
  if (t.length > max) falha(`máximo de ${max} caracteres`);
  if (t.includes('\u0000')) falha('caractere inválido');
  return t;
};
const opcoes = (...lista) => (v) => {
  const t = String(v).trim();
  if (!lista.includes(t)) falha(`valores aceitos: ${lista.join(', ')}`);
  return t;
};
// Lista CSV de números (só dígitos, 8–15) — aceita apelido? NÃO: apelido vai em outra chave.
const numeros = (v) => {
  const itens = String(v).split(',').map((x) => x.trim()).filter(Boolean);
  for (const i of itens) if (!/^\d{8,15}$/.test(i)) falha(`número inválido: "${i}" (só dígitos, com DDI+DDD)`);
  return [...new Set(itens)].join(',');
};
// Destinos de aviso: números (dígitos) e/ou JIDs de grupo (...@g.us).
const destinos = (v) => {
  const itens = String(v).split(',').map((x) => x.trim()).filter(Boolean);
  for (const i of itens) {
    if (!/^\d{8,15}$/.test(i) && !/^[\w-]{5,60}@g\.us$/.test(i)) falha(`destino inválido: "${i}" (número ou ...@g.us)`);
  }
  return [...new Set(itens)].join(',');
};
const csvTexto = (maxItem = 80, maxItens = 100) => (v) => {
  const itens = String(v).split(',').map((x) => x.trim()).filter(Boolean);
  if (itens.length > maxItens) falha('itens demais');
  for (const i of itens) if (i.length > maxItem) falha(`item muito longo: "${i.slice(0, 20)}…"`);
  return itens.join(',');
};
const grade = (v) => {
  const itens = String(v).split(',').map((x) => x.trim()).filter(Boolean);
  if (!itens.length) falha('informe ao menos um horário');
  for (const i of itens) if (!HHMM.test(i)) falha(`horário inválido: "${i}"`);
  return [...new Set(itens)].sort().join(',');
};
const slugModelo = (v) => {
  const t = String(v).trim();
  if (!/^[A-Za-z0-9._-]+\/[A-Za-z0-9._:-]+$/.test(t)) falha('esperado slug do OpenRouter (ex.: provedor/modelo)');
  return t;
};
const jsonCom = (checar) => (v) => {
  let o;
  try { o = JSON.parse(String(v)); } catch { falha('JSON inválido'); }
  checar(o);
  return JSON.stringify(o);
};
const janelaJson = jsonCom((o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) falha('esperado objeto {"default":["06:30","22:00"], "0":[...]}');
  for (const [k, par] of Object.entries(o)) {
    if (k !== 'default' && !/^[0-6]$/.test(k)) falha(`chave inválida: "${k}" (use default ou 0–6)`);
    if (par !== null && !(Array.isArray(par) && par.length === 2 && HHMM.test(par[0]) && HHMM.test(par[1]) && par[0] < par[1])) {
      falha(`janela inválida em "${k}" (início < fim, HH:MM)`);
    }
  }
  if (!o.default) falha('falta a janela "default"');
});
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pausasJson = jsonCom((o) => {
  if (!Array.isArray(o) || o.length > 100) falha('esperado lista de pausas');
  for (const p of o) {
    if (!p || !ISO.test(p.de) || !ISO.test(p.ate) || p.de > p.ate) falha('pausa inválida (de/ate em AAAA-MM-DD, de ≤ ate)');
    if (p.msg !== undefined && (typeof p.msg !== 'string' || p.msg.length > 300)) falha('mensagem da pausa inválida (máx. 300)');
  }
});
const apelidosJson = jsonCom((o) => {
  if (!o || typeof o !== 'object' || Array.isArray(o)) falha('esperado objeto número→apelido');
  for (const [k, a] of Object.entries(o)) {
    if (!/^\d{8,15}$/.test(k) || typeof a !== 'string' || a.length > 60) falha('apelido inválido');
  }
});

// Motivos que geram aviso (um toggle por motivo: aviso_toggle_<motivo>).
export const MOTIVOS_AVISO = [
  ['foto', 'Foto'],
  ['audio', 'Áudio não entendido'],
  ['remarcacao', 'Remarcação'],
  ['cancelamento', 'Cancelamento'],
  ['atraso', 'Atraso / falta'],
  ['desconto', 'Desconto / negociação'],
  ['pessoa_especifica', 'Pessoa específica'],
  ['sem_foto_modelo', 'Sem foto do modelo'],
  ['agendamento_em_cima_da_hora', 'Agendamento em cima da hora'],
  ['opt-out', 'Opt-out (parar mensagens)'],
  ['erro_ia', 'Erro da IA'],
  ['guardrail', 'Guardrail (manipulação / dados de terceiros / ofensivo)'],
];

const FIXAS = {
  // Controle (16)
  bot_enabled: bool,
  bot_mode: opcoes('off', 'test', 'shadow', 'production'),
  test_numbers: numeros,
  cidades_ativas: csvTexto(80, 80),
  ignore_numbers: numeros,
  ignore_apelidos_json: apelidosJson, // extensão do painel (apelido dos ignorados) — ver PR
  admin_numbers: numeros,
  janela_json: janelaJson,
  pausas_json: pausasJson,
  delay_digit_min_s: inteiro(0, 120),
  delay_digit_max_s: inteiro(0, 120),
  debounce_s: inteiro(0, 300),
  lead_novo_espera_min: inteiro(0, 60),
  intervalo_fotos_s: inteiro(0, 60),
  humano_cooldown_h: inteiro(0, 168),
  handoff_destinos: destinos,
  aviso_limite_h: hora,
  resumo_manha_h: hora,
  relatorio_destinos: destinos,
  relatorio_h: hora,
  raio_km: inteiro(1, 200),
  followup_horas: inteiro(1, 72),
  followup_max: inteiro(0, 2),
  persona_nome: texto(40),
  persona_emojis: opcoes('nenhum', 'pouco', 'normal'),
  pix_chave: texto(80),
  // Negócio
  preco_leve_pix: decimal(1, 9999),
  preco_leve_cartao: decimal(1, 9999),
  preco_pesado_pix: decimal(1, 9999),
  preco_pesado_cartao: decimal(1, 9999),
  duracao_min: inteiro(10, 240),
  grade_horarios: grade,
  ultimo_horario_sabado: hora,
  almoco_regra: bool,
  aviso_cima_hora_min: inteiro(0, 240),
  texto_fotos_marca: texto(600),
  texto_fora_escopo: texto(600),
  max_fotos: inteiro(1, 10),
  max_chars_resposta: inteiro(100, 2000),
  audio_transcricao: bool,
  foto_modo: opcoes('chamar_maria', 'analisar'),
  // IA / custo
  ia_modelo: slugModelo,
  ia_modelo_fallback: slugModelo,
  usd_brl: decimal(0.1, 100),
  ia_teto_dia_brl: decimal(0, 100000),
  ia_teto_mes_brl: decimal(0, 100000),
  shadow_max_dia: inteiro(0, 100000),
  // Textos editáveis
  prompt_script: texto(30000, { obrigatorio: true }),
  prompt_material: texto(30000, { obrigatorio: true }),
  photo_caption: texto(4000),
  scarcity_text: texto(4000),
  info_text: texto(8000),
  closing_text: texto(4000),
};

const RE_TOGGLE = /^aviso_toggle_([a-z][a-z_-]{1,60})$/;

export const CHAVES_CONFIG = new Set([
  ...Object.keys(FIXAS),
  ...MOTIVOS_AVISO.map(([m]) => `aviso_toggle_${m}`),
]);

export function chavePermitida(key) {
  return key in FIXAS || RE_TOGGLE.test(key);
}

// Valida e normaliza. Lança Error com mensagem em PT-BR (inclui o nome da chave).
export function validarConfig(key, valor) {
  if (typeof valor !== 'string') falha(`${key}: valor deve ser texto`);
  if (key in FIXAS) {
    try { return FIXAS[key](valor); } catch (e) { throw new Error(`${key}: ${e.message}`); }
  }
  if (RE_TOGGLE.test(key)) {
    try { return bool(valor); } catch (e) { throw new Error(`${key}: ${e.message}`); }
  }
  throw new Error(`chave não permitida: ${key}`);
}

// Validações cruzadas (antes de gravar um lote).
export function validarLote(mapa) {
  const mn = mapa.delay_digit_min_s; const mx = mapa.delay_digit_max_s;
  if (mn !== undefined && mx !== undefined && Number(mn) > Number(mx)) {
    throw new Error('delay_digit_min_s não pode ser maior que delay_digit_max_s');
  }
}

// Mesma regra de últimos 8 dígitos do bot (tolera o 9º dígito).
export const ult8 = (s) => String(s || '').replace(/\D/g, '').slice(-8);
