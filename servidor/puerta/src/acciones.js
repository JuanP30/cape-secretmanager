// Lo único que la Puerta sabe hacer con una clave. La clave nunca sale: entra por variable de
// entorno (ssh) o cabecera (api) y todo lo que vuelve pasa por tapar().
import { spawn } from 'node:child_process';
import { campo, secretosDe } from './vault.js';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';

const MAX_SALIDA = 5_000_000; // los workflows grandes de n8n pasan de 1 MB (22-oct)

export function tapar(texto, secretos) {
  let t = String(texto);
  for (const s of secretos) if (s && String(s).length >= 4) t = t.split(String(s)).join('••••');
  return t;
}

const host = (item) => campo(item, 'cape_host')
  || String(item.login?.uris?.[0]?.uri || '').replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '');

export function ejecutarSsh(item, comando, { spawnFn = spawn, timeoutMs = 120_000 } = {}) {
  const usuario = item.login?.username || 'root';
  const puerto = campo(item, 'cape_puerto') || '22';
  const args = ['-e', 'ssh', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'PubkeyAuthentication=no',
    '-o', 'ConnectTimeout=15', '-p', puerto, `${usuario}@${host(item)}`, String(comando)];
  return new Promise((resolve) => {
    const p = spawnFn('sshpass', args, { env: { ...process.env, SSHPASS: item.login?.password || '' } });
    let salida = '';
    const sumar = (b) => { if (salida.length < MAX_SALIDA) salida += b.toString(); };
    p.stdout.on('data', sumar); p.stderr.on('data', sumar);
    const reloj = setTimeout(() => { salida += '\n[cape] tiempo agotado'; p.kill('SIGKILL'); }, timeoutMs);
    p.on('close', (codigo) => { clearTimeout(reloj); resolve({ codigo: codigo ?? 1, salida: tapar(salida, secretosDe(item)) }); });
  });
}

const METODOS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export async function llamarApi(item, metodo, ruta, cuerpo, f = fetch) {
  const m = String(metodo).toUpperCase();
  if (!METODOS.has(m)) throw new Error(`método no permitido: ${m}`);
  const base = new URL(campo(item, 'cape_base') || item.login?.uris?.[0]?.uri);
  const r = String(ruta);
  if (!r.startsWith('/') || r.startsWith('//')) throw new Error('la ruta debe empezar por / (mismo origen)');
  const url = new URL(base.pathname.replace(/\/$/, '') + r, base.origin);
  if (url.origin !== base.origin) throw new Error('origen distinto al de la credencial');
  const cabecera = campo(item, 'cape_cabecera') || 'Authorization';
  const prefijo = campo(item, 'cape_prefijo') ?? (cabecera === 'Authorization' ? 'Bearer ' : '');
  const headers = { [cabecera]: prefijo + (item.login?.password || ''), Accept: 'application/json' };
  if (cuerpo) headers['Content-Type'] = 'application/json';
  const resp = await f(url, { method: m, headers, body: cuerpo || undefined });
  const texto = (await resp.text()).slice(0, MAX_SALIDA);
  return { estado: resp.status, salida: tapar(texto, secretosDe(item)) };
}

// ── FTP (deploys a Banahosting) ─────────────────────────────────────────────────────────────
// curl con la credencial por stdin (`-K -`), nunca en argumentos. `--ftp-ssl-control` y NUNCA
// `--ftp-ssl`: con TLS completo el STOR de Banahosting da 451 después de vaciar el archivo vivo.

const PROHIBIDOS = /(config\.php$|\.env(\.|$)|\.sql$|\/db\/|\.htpasswd$|\/\.git\/)/i;

export function rutaFtpValida(item, ruta) {
  const raiz = campo(item, 'cape_raiz') || '/';
  const r = String(ruta);
  if (!r.startsWith('/') || r.split('/').includes('..') || posix.normalize(r) !== r) throw new Error(`ruta inválida: ${r}`);
  if (!r.startsWith(raiz)) throw new Error(`ruta fuera de ${raiz}: ${r}`);
  if (PROHIBIDOS.test(r)) throw new Error(`ruta prohibida (configuración o datos del servidor): ${r}`);
  return r;
}

function curlFtp(item, args, { spawnFn = spawn, timeoutMs = 120_000 } = {}) {
  const host = campo(item, 'cape_host') || String(item.login?.uris?.[0]?.uri || '').replace(/^[a-z]+:\/\//, '').replace(/\/.*$/, '');
  return (ruta) => new Promise((resolve) => {
    const p = spawnFn('curl', ['-sS', '-K', '-', '-k', '--ftp-ssl-control', '--max-time', String(timeoutMs / 1000), ...args, `ftp://${host}${ruta}`]);
    let err = '';
    p.stderr.on('data', (b) => { err += b; });
    p.stdout.on('data', () => {});
    p.stdin.write(`user = "${item.login?.username}:${item.login?.password}"\n`); p.stdin.end();
    p.on('close', (codigo) => resolve({ codigo: codigo ?? 1, error: tapar(err, secretosDe(item)) }));
  });
}

export async function ftpBajar(item, ruta, opciones = {}) {
  rutaFtpValida(item, ruta);
  const dir = mkdtempSync(join(tmpdir(), 'cape-ftp-')); const f = join(dir, 'archivo');
  try {
    const r = await curlFtp(item, ['-f', '-o', f], opciones)(ruta);
    return r.codigo === 0 ? readFileSync(f) : null;
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

export async function ftpSubir(item, ruta, contenido, opciones = {}) {
  rutaFtpValida(item, ruta);
  const dir = mkdtempSync(join(tmpdir(), 'cape-ftp-')); const f = join(dir, 'archivo');
  try {
    writeFileSync(f, contenido);
    const r = await curlFtp(item, ['-f', '-T', f, '--ftp-create-dirs'], opciones)(ruta);
    if (r.codigo !== 0) throw new Error(`no se pudo subir ${ruta}: ${r.error.trim() || 'curl ' + r.codigo}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
  const sha = (b) => createHash('sha256').update(b).digest('hex');
  const vuelta = await ftpBajar(item, ruta, opciones);
  if (!vuelta || sha(vuelta) !== sha(contenido)) throw new Error(`verificación fallida: ${ruta} no quedó igual en el servidor`);
  return { sha: sha(contenido) };
}
