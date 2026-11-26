// app/utils/ghlServer.js
// Acesso ao GoHighLevel (LeadConnector) SÓ NO SERVIDOR. A chave nunca vai ao navegador.
// Envs (as mesmas do bot): GHL_API_KEY, GHL_LOCATION_ID, GHL_BASE_URL (opcional).
// Tudo é tolerante a falha: sem GHL configurado, as telas funcionam sem esses dados.
const BASE = () => process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com';
// Cloudflare do GHL exige User-Agent de navegador (senão 403 / error_code 1010).
export const UA_NAVEGADOR =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export const ghlConfigurado = () => Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);

async function ghl(path, init = {}) {
  const res = await fetch(BASE() + path, {
    ...init,
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      Version: '2021-07-28',
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': UA_NAVEGADOR,
      ...(init.headers || {}),
    },
  });
  const txt = await res.text();
  let data = null;
  try { data = txt ? JSON.parse(txt) : null; } catch { data = null; }
  if (!res.ok) throw new Error(`GHL ${res.status}`);
  return data;
}

// Endereço do local por calendário: teamMembers[].locationConfigurations[].location.
// Cache em memória de 30 min (igual ao bot).
const cacheLocal = new Map(); // calendarId -> { t, v }
export async function enderecoDoCalendario(calendarId) {
  if (!ghlConfigurado() || !calendarId) return null;
  const hit = cacheLocal.get(calendarId);
  if (hit && Date.now() - hit.t < 30 * 60 * 1000) return hit.v;
  try {
    const d = await ghl(`/calendars/${encodeURIComponent(calendarId)}`);
    const cal = d?.calendar || d;
    const locais = [];
    for (const tm of cal?.teamMembers || []) {
      for (const lc of tm?.locationConfigurations || []) {
        const l = String(lc?.location || '').trim();
        if (l && !locais.includes(l)) locais.push(l);
      }
    }
    const v = locais[0] || null;
    cacheLocal.set(calendarId, { t: Date.now(), v });
    return v;
  } catch {
    return null; // não cacheia falha
  }
}

export async function tagsDoContato(contactId) {
  if (!ghlConfigurado() || !contactId) return null;
  try {
    const d = await ghl(`/contacts/${encodeURIComponent(contactId)}`);
    return Array.isArray(d?.contact?.tags) ? d.contact.tags : [];
  } catch { return null; }
}

// Sincroniza tags bot-off / bot-ativo. Nunca lança: devolve { ok, erro? }.
export async function sincronizarTags(contactId, { adicionar = [], remover = [] }) {
  if (!ghlConfigurado()) return { ok: false, erro: 'GHL não configurado no servidor (GHL_API_KEY/GHL_LOCATION_ID)' };
  if (!contactId) return { ok: false, erro: 'contato sem ghl_contact_id' };
  try {
    const id = encodeURIComponent(contactId);
    if (remover.length) await ghl(`/contacts/${id}/tags`, { method: 'DELETE', body: JSON.stringify({ tags: remover }) });
    if (adicionar.length) await ghl(`/contacts/${id}/tags`, { method: 'POST', body: JSON.stringify({ tags: adicionar }) });
    return { ok: true };
  } catch (e) { return { ok: false, erro: e.message }; }
}

export function linkContatoGhl(contactId) {
  const loc = process.env.GHL_LOCATION_ID;
  if (!loc || !contactId) return null;
  return `https://app.gohighlevel.com/v2/location/${encodeURIComponent(loc)}/contacts/detail/${encodeURIComponent(contactId)}`;
}
