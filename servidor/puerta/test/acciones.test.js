import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { tapar, ejecutarSsh, llamarApi } from '../src/acciones.js';

test('tapar reemplaza cada secreto, incluso repetido', () => {
  assert.equal(tapar('a s3cr3t b s3cr3t', ['s3cr3t']), 'a •••• b ••••');
  assert.equal(tapar('abc', ['', null, 'ab']), 'abc'); // secretos de <4 caracteres no se tocan
});

const ITEM_SSH = { login: { username: 'root', password: 'clave-EJEMPLO-ssh', uris: [{ uri: 'ssh://10.0.0.5' }] },
  fields: [{ name: 'cape_puerto', value: '2222' }] };

test('ejecutarSsh pasa la clave por SSHPASS, no por argumentos, y tapa la salida', async () => {
  let visto;
  const spawnFn = (cmd, args, opts) => {
    visto = { cmd, args, env: opts.env };
    const p = new EventEmitter(); p.stdout = new EventEmitter(); p.stderr = new EventEmitter(); p.kill = () => {};
    setImmediate(() => { p.stdout.emit('data', Buffer.from('hola clave-EJEMPLO-ssh\n')); p.emit('close', 0); });
    return p;
  };
  const r = await ejecutarSsh(ITEM_SSH, 'echo hola', { spawnFn });
  assert.equal(visto.cmd, 'sshpass');
  assert.ok(!visto.args.join(' ').includes('clave-EJEMPLO-ssh'));
  assert.equal(visto.env.SSHPASS, 'clave-EJEMPLO-ssh');
  assert.ok(visto.args.includes('root@10.0.0.5'));
  assert.ok(visto.args.includes('2222'));
  assert.deepEqual(r, { codigo: 0, salida: 'hola ••••\n' });
});

const ITEM_API = { login: { password: 'k-EJEMPLO-123', uris: [{ uri: 'https://n8n.ejemplo.com/api/v1' }] },
  fields: [{ name: 'cape_cabecera', value: 'X-N8N-API-KEY' }] };

test('llamarApi pone la cabecera, usa el origen guardado y tapa la respuesta', async () => {
  let visto;
  const f = async (url, o) => { visto = { url: String(url), o }; return { status: 200, text: async () => '{"k":"k-EJEMPLO-123"}' }; };
  const r = await llamarApi(ITEM_API, 'GET', '/workflows?limit=1', '', f);
  assert.equal(visto.url, 'https://n8n.ejemplo.com/api/v1/workflows?limit=1');
  assert.equal(visto.o.headers['X-N8N-API-KEY'], 'k-EJEMPLO-123');
  assert.deepEqual(r, { estado: 200, salida: '{"k":"••••"}' });
});

test('llamarApi no manda la clave a otro dominio ni con métodos raros', async () => {
  const f = async () => { throw new Error('no debía llamar'); };
  await assert.rejects(llamarApi(ITEM_API, 'GET', '//otro.com/x', '', f), /origen/);
  await assert.rejects(llamarApi(ITEM_API, 'GET', 'https://otro.com/x', '', f), /origen/);
  await assert.rejects(llamarApi(ITEM_API, 'TRACE', '/x', '', f), /método/);
});
