import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync, writeFileSync } from 'node:fs';
import { rutaFtpValida, ftpBajar, ftpSubir } from '../src/acciones.js';

const ITEM = { login: { username: 'ftp-EJEMPLO', password: 'clave-EJEMPLO-ftp', uris: [{ uri: 'ftp.ejemplo.com' }] },
  fields: [{ name: 'cape_raiz', value: '/ejemplo.com/' }] };

test('rutas: dentro de la raíz, sin .. ni archivos prohibidos', () => {
  assert.equal(rutaFtpValida(ITEM, '/ejemplo.com/club/portal.js'), '/ejemplo.com/club/portal.js');
  for (const mala of ['/otro.com/x.js', '/ejemplo.com/../etc/passwd', '/ejemplo.com/club/config.php',
    '/ejemplo.com/.env', '/ejemplo.com/db/x.sqlite', '/ejemplo.com/a.sql', '/ejemplo.com/.git/config', 'relativa.js'])
    assert.throws(() => rutaFtpValida(ITEM, mala), /ruta/, mala);
});

// curl falso: guarda lo que "sube" y lo devuelve al "bajar". Lee usuario:clave de stdin (-K -).
function curlFalso(remoto, { corromper = false } = {}) {
  const llamadas = [];
  const spawnFn = (cmd, args) => {
    const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter();
    let config = ''; p.stdin = { write: (s) => { config += s; }, end: () => {} };
    llamadas.push({ cmd, args, get config() { return config; } });
    setImmediate(() => {
      const i = args.indexOf('-T'), o = args.indexOf('-o');
      if (i >= 0) { remoto.contenido = readFileSync(args[i + 1]); if (corromper) remoto.contenido = Buffer.from('otra cosa'); p.emit('close', 0); }
      else if (o >= 0) { if (!remoto.contenido) return p.emit('close', 78); writeFileSync(args[o + 1], remoto.contenido); p.emit('close', 0); }
    });
    return p;
  };
  return { spawnFn, llamadas };
}

test('subir verifica bajando de nuevo; la clave va por stdin, no en argumentos', async () => {
  const remoto = {}; const { spawnFn, llamadas } = curlFalso(remoto);
  const r = await ftpSubir(ITEM, '/ejemplo.com/club/a.js', Buffer.from('hola'), { spawnFn });
  assert.match(r.sha, /^[0-9a-f]{64}$/);
  assert.equal(llamadas.length, 2); // subir + bajar para verificar
  for (const l of llamadas) {
    assert.ok(!l.args.join(' ').includes('clave-EJEMPLO-ftp'));
    assert.match(l.config, /user = "ftp-EJEMPLO:clave-EJEMPLO-ftp"/);
    assert.ok(l.args.includes('--ftp-ssl-control') && !l.args.includes('--ftp-ssl'));
  }
  assert.deepEqual(await ftpBajar(ITEM, '/ejemplo.com/club/a.js', { spawnFn }), Buffer.from('hola'));
});

test('si lo bajado no coincide con lo subido, falla', async () => {
  const remoto = {}; const { spawnFn } = curlFalso(remoto, { corromper: true });
  await assert.rejects(ftpSubir(ITEM, '/ejemplo.com/club/a.js', Buffer.from('hola'), { spawnFn }), /verific/);
});

test('bajar un archivo que no existe → null', async () => {
  const { spawnFn } = curlFalso({});
  assert.equal(await ftpBajar(ITEM, '/ejemplo.com/club/nuevo.js', { spawnFn }), null);
});
