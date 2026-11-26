// app/utils/urlSegura.js
// Validação de URL de instância (18.2) contra SSRF e utilitários de mascaramento.
import dns from 'node:dns/promises';
import net from 'node:net';

function ipPrivado(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const t = ip.toLowerCase();
    return t === '::1' || t === '::' || t.startsWith('fc') || t.startsWith('fd') || t.startsWith('fe80') || t.startsWith('::ffff:');
  }
  return true;
}

// Formato: https, sem credenciais/query/hash, host não-IP-privado. Sem DNS.
export function validarBaseUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { throw new Error('base_url inválida'); }
  if (u.protocol !== 'https:') throw new Error('base_url deve usar https');
  if (u.username || u.password) throw new Error('base_url não pode conter usuário/senha');
  if (u.search || u.hash) throw new Error('base_url não deve ter query/hash');
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('host não permitido');
  if (net.isIP(h.replace(/^\[|\]$/g, '')) && ipPrivado(h.replace(/^\[|\]$/g, ''))) throw new Error('host não permitido');
  return u.origin + u.pathname.replace(/\/+$/, '');
}

// Antes de CHAMAR a instância: resolve o DNS e recusa IP privado (anti-SSRF).
export async function garantirHostPublico(baseUrl) {
  const host = new URL(baseUrl).hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) { if (ipPrivado(host)) throw new Error('host não permitido'); return; }
  const addrs = await dns.lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => ipPrivado(a.address))) throw new Error('host resolve para endereço não permitido');
}

export const mascararToken = (t) => {
  const s = String(t || '');
  return s ? '••••' + s.slice(-4) : '';
};

// Remove o token de qualquer texto e chaves sensíveis de objetos antes de ir ao navegador.
export function higienizar(valor, token) {
  const limpa = (x) => {
    if (typeof x === 'string') return token ? x.split(token).join('••••') : x;
    if (Array.isArray(x)) return x.map(limpa);
    if (x && typeof x === 'object') {
      const o = {};
      for (const [k, v] of Object.entries(x)) {
        o[k] = /token|apikey|api_key|secret|password|authorization/i.test(k) ? '••••' : limpa(v);
      }
      return o;
    }
    return x;
  };
  return limpa(valor);
}
