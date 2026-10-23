import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/db.js';
import { crearServidor } from '../src/servidor.js';

const COL = [{ id: 'c2', nombre: 'VPS' }];
const VPS = { name: 'VPS', collectionIds: ['c2'], login: { username: 'root', password: 'clave-EJEMPLO-9' },
  fields: [{ name: 'cape_alias', value: 'vps' }, { name: 'cape_tipo', value: 'ssh' }] };
const vault = { sincronizar: async () => {}, colecciones: async () => COL, items: async () => [VPS] };
const acciones = {
  ejecutarSsh: async (item, cmd) => ({ codigo: 0, salida: `ejecuté ${cmd} en ${item.name}` }),
  llamarApi: async () => ({ estado: 200, salida: '{}' }),
};

async function arrancar() {
  const db = D.abrir(':memory:');
  const srv = crearServidor({ db, vault, acciones, ahora: () => 1_000 });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = (ruta, datos, token) => fetch(base + ruta, { method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: new URLSearchParams(datos) });
  return { db, srv, base, post };
}

test('vinculación completa y acción ssh con historial', async (t) => {
  const { db, srv, base, post } = await arrancar(); t.after(() => srv.close());
  const s = await (await post('/v1/conectar', { equipo: 'Mac de prueba' })).json();
  assert.match(s.codigo, /^...-...$/);
  assert.equal((await (await post('/v1/conectar/estado', { id: s.id, sondeo: s.sondeo })).json()).estado, 'pendiente');
  D.aprobar(db, s.codigo, ['VPS'], 1_000);
  const { token } = await (await post('/v1/conectar/estado', { id: s.id, sondeo: s.sondeo })).json();

  const lista = await (await fetch(base + '/v1/credenciales', { headers: { Authorization: `Bearer ${token}` } })).text();
  assert.equal(lista.trim(), 'vps\tssh\tVPS\tVPS');
  assert.ok(!lista.includes('clave-EJEMPLO-9'));

  const r = await post('/v1/ssh', { alias: 'vps', comando: 'docker ps' }, token);
  assert.equal(r.headers.get('x-cape-codigo'), '0');
  assert.equal(await r.text(), 'ejecuté docker ps en VPS');
  assert.equal(D.listarHistorial(db, 5)[0].accion, 'ssh');
});

test('sin token, token revocado o alias ajeno → rechazo', async (t) => {
  const { db, srv, post } = await arrancar(); t.after(() => srv.close());
  assert.equal((await post('/v1/ssh', { alias: 'vps', comando: 'ls' })).status, 401);
  const s = await (await post('/v1/conectar', { equipo: 'X' })).json();
  D.aprobar(db, s.codigo, ['Club'], 1_000); // empresa sin el VPS
  const { token } = await (await post('/v1/conectar/estado', { id: s.id, sondeo: s.sondeo })).json();
  assert.equal((await post('/v1/ssh', { alias: 'vps', comando: 'ls' }, token)).status, 404);
  assert.equal((await post('/v1/desconectar', {}, token)).status, 200);
  assert.equal((await post('/v1/ssh', { alias: 'vps', comando: 'ls' }, token)).status, 401);
});

test('alias de tipo equivocado → 400', async (t) => {
  const { db, srv, post } = await arrancar(); t.after(() => srv.close());
  const s = await (await post('/v1/conectar', { equipo: 'X' })).json();
  D.aprobar(db, s.codigo, ['VPS'], 1_000);
  const { token } = await (await post('/v1/conectar/estado', { id: s.id, sondeo: s.sondeo })).json();
  assert.equal((await post('/v1/api', { alias: 'vps', metodo: 'GET', ruta: '/x' }, token)).status, 400);
});
