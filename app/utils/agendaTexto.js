// app/utils/agendaTexto.js
// Parser do texto colado no /admin para a agenda das regionais.
// Aceita linhas como (data e cidade em qualquer ordem):
//   Divinópolis 27/11
//   27/11 Divinópolis
//   Divinópolis - 27/11/2026
//   Divinópolis: 2026-11-27
//   Sete Lagoas 26/11/2026
// Linhas vazias e começadas por # são ignoradas.

export const normCidade = (s) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function parseAgendaTexto(texto) {
  const itens = [];
  const invalidas = [];

  for (const raw of String(texto || "").split(/\r?\n/)) {
    const linha = raw.trim();
    if (!linha || linha.startsWith("#")) continue;

    let dia = null, mes = null, ano = null, trechoData = "";
    let m;
    if ((m = linha.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) {
      ano = +m[1]; mes = +m[2]; dia = +m[3]; trechoData = m[0];
    } else if ((m = linha.match(/(\d{1,2})[/\-.](\d{1,2})(?:[/\-.](\d{2,4}))?/))) {
      dia = +m[1]; mes = +m[2];
      ano = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null;
      trechoData = m[0];
    }

    if (!dia || !mes || dia > 31 || mes > 12) { invalidas.push(linha); continue; }

    const cidade = linha
      .replace(trechoData, " ")
      .replace(/[-–—:|,;]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!cidade) { invalidas.push(linha); continue; }
    itens.push({ cidade, dia, mes, ano, linha });
  }

  return { itens, invalidas };
}

// Converte {dia,mes,ano?} em "YYYY-MM-DD". Sem ano, usa o ano corrente — e, se a
// data já passou, o próximo ano (agenda é sempre futura).
export function paraISO({ dia, mes, ano }, hoje = new Date()) {
  const anoFinal = ano || hoje.getFullYear();
  const iso = `${String(anoFinal).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  if (!ano && new Date(iso + "T23:59:59") < hoje) {
    return `${String(anoFinal + 1).padStart(4, "0")}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
  }
  return iso;
}
