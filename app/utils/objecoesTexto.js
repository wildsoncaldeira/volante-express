// app/utils/objecoesTexto.js
// Importação em massa de objeções (itens 15.4 / 15.13).
// Formato, uma por linha:   gatilhos | resposta | ação
//   - gatilhos separados por ";"
//   - ação: responder | chamar_maria  (vazia = responder)
//   - linhas vazias e começadas por # são ignoradas
//   - a resposta pode conter "|" (tudo entre o 1º e o último "|" vira resposta;
//     o último trecho só é lido como ação se for uma ação reconhecida)
// Variáveis aceitas na resposta: {preco_pix} {preco_cartao} {local} {city} {date}

export const VARIAVEIS_OBJECAO = ['preco_pix', 'preco_cartao', 'local', 'city', 'date'];

const ACOES = {
  responder: 'responder',
  chamar_maria: 'chamar_maria',
  'chamar maria': 'chamar_maria',
  chamarmaria: 'chamar_maria',
};

export const normAcao = (s) => {
  const k = String(s || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[-\s]+/g, ' ');
  return ACOES[k] || ACOES[k.replace(/ /g, '_')] || null;
};

export function splitGatilhos(s) {
  const vistos = new Set();
  const out = [];
  for (const g of String(s || '').split(';')) {
    const t = g.trim().replace(/\s+/g, ' ');
    const k = t.toLowerCase();
    if (t && !vistos.has(k)) { vistos.add(k); out.push(t); }
  }
  return out;
}

export function variaveisDesconhecidas(resposta) {
  const achadas = [...String(resposta || '').matchAll(/\{([^{}]*)\}/g)].map((m) => m[1]);
  return [...new Set(achadas.filter((v) => !VARIAVEIS_OBJECAO.includes(v)))];
}

// → { itens: [{gatilhos, resposta, acao, linha}], erros: [{linha, motivo}], avisos: [{linha, motivo}] }
export function parseObjecoesTexto(texto) {
  const itens = [];
  const erros = [];
  const avisos = [];
  for (const bruta of String(texto || '').split(/\r?\n/)) {
    const linha = bruta.trim();
    if (!linha || linha.startsWith('#')) continue;
    const partes = linha.split('|').map((p) => p.trim());
    if (partes.length < 2) { erros.push({ linha, motivo: 'faltam campos (use: gatilhos | resposta | ação)' }); continue; }
    let acao = 'responder';
    let corpo = partes;
    if (partes.length >= 3) {
      const ultimaBruta = partes[partes.length - 1];
      const ultima = normAcao(ultimaBruta);
      if (ultima) { acao = ultima; corpo = partes.slice(0, -1); }
      else if (ultimaBruta === '') { corpo = partes.slice(0, -1); }
      else if (partes.length === 3) { erros.push({ linha, motivo: `ação inválida: "${ultimaBruta}" (use responder ou chamar_maria)` }); continue; }
    }
    const gatilhos = splitGatilhos(corpo[0]);
    const resposta = corpo.slice(1).join(' | ').trim();
    if (!gatilhos.length) { erros.push({ linha, motivo: 'sem gatilhos' }); continue; }
    if (!resposta) { erros.push({ linha, motivo: 'sem resposta' }); continue; }
    if (resposta.length > 2000) { erros.push({ linha, motivo: 'resposta com mais de 2000 caracteres' }); continue; }
    if (gatilhos.length > 40 || gatilhos.some((g) => g.length > 120)) { erros.push({ linha, motivo: 'gatilhos demais ou muito longos' }); continue; }
    const desc = variaveisDesconhecidas(resposta);
    if (desc.length) avisos.push({ linha, motivo: `variável desconhecida: ${desc.map((d) => `{${d}}`).join(', ')}` });
    itens.push({ gatilhos, resposta, acao, linha });
  }
  return { itens, erros, avisos };
}
