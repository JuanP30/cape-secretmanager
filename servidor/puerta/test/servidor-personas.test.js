import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/db.js';
import * as P from '../src/personas.js';
import { crearServidor } from '../src/servidor.js';

const COL = [{ id: 'c1', nombre: 'Club' }, { id: 'c2', nombre: 'VPS' }];
const ITEMS = [
  { id: 'i1', type: 1, name: 'FTP Club', collectionIds: ['c1'], login: { username: 'ftp-EJEMPLO', password: 'clave-EJEMPLO-ftp', uris: [{ uri: 'ftp.ejemplo.com' }] },
    fields: [{ name: 'cape_alias', value: 'club' }, { name: 'cape_tipo', value: 'ftp' }] },
  { id: 'i2', type: 2, name: 'Nota', collectionIds: ['c2'], notes: 'texto' },
];
function vaultFalso() {
  const creados = [];
  return {
    creados,
    sincronizar: async () => {}, colecciones: async () => COL, items: async () => ITEMS,
    organizacion: async () => 'org-1',
    crearItem: async (it) => { creados.push(it); return { id: 'nuevo' }; },
    crearColeccion: async (org, nombre) => { creados.push({ org, nombre }); return { id: 'c9' }; },
  };
}
const T = Date.now();

async function arrancar() {
  const db = D.abrir(':memory:');
  const codigo = P.crearAlta(db, 'g@e.co', 'Gestor', T);
  const s = new URL(P.completarAlta(db, 'g@e.co', codigo, 'clave-del-gestor-123', T)).searchParams.get('secret');
  P.confirmarTotp(db, 'g@e.co', P.totp(s, T), T);
  const vault = vaultFalso();
  const srv = crearServidor({ db, vault, acciones: {} });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${srv.address().port}`;
  const pedir = (ruta, datos, token, extra = {}) => fetch(base + ruta, { method: datos ? 'POST' : 'GET',
    headers: { ...(datos ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: datos ? new URLSearchParams(datos) : undefined });
  const persona = (await (await pedir('/v1/personas/entrar', { correo: 'g@e.co', clave: 'clave-del-gestor-123', totp: P.totp(s, Date.now()), equipo: 'Mac' })).json()).token;
  return { db, srv, pedir, persona, vault, secreto: s };
}

test('la persona entra, ve el panel y aprueba a un Claude', async (t) => {
  const { srv, pedir, persona } = await arrancar(); t.after(() => srv.close());
  assert.equal(persona.length, 64);
  const sol = await (await pedir('/v1/conectar', { equipo: 'Mac de Claude' })).json();
  const panel = await (await pedir('/v1/panel', null, persona)).json();
  assert.deepEqual(panel.credenciales.map((c) => c.nombre), ['FTP Club']); // solo inicios de sesión
  assert.equal(panel.solicitudes[0].codigo, sol.codigo);
  assert.ok(!JSON.stringify(panel).includes('clave-EJEMPLO-ftp'));
  assert.equal((await pedir('/v1/aprobar', { codigo: sol.codigo, empresas: 'Club' }, persona)).status, 200);
  const est = await (await pedir('/v1/conectar/estado', { id: sol.id, sondeo: sol.sondeo })).json();
  assert.equal(est.estado, 'aprobada');
});

test('un Claude no puede usar las rutas de persona (403)', async (t) => {
  const { db, srv, pedir } = await arrancar(); t.after(() => srv.close());
  const sol = D.crearSolicitud(db, 'X', Date.now()); D.aprobar(db, sol.codigo, ['Club'], Date.now());
  const { token } = D.sondear(db, sol.id, sol.sondeo, Date.now());
  for (const [ruta, datos] of [['/v1/panel', null], ['/v1/copiar', { id: 'i1' }], ['/v1/aprobar', { codigo: 'X', empresas: 'Club' }],
    ['/v1/credenciales', { empresa: 'Club', nombre: 'x' }], ['/v1/empresas', { nombre: 'x' }]])
    assert.equal((await pedir(ruta, datos, token)).status, 403, ruta);
});

test('copiar devuelve el valor solo a la persona y queda en el historial', async (t) => {
  const { db, srv, pedir, persona } = await arrancar(); t.after(() => srv.close());
  const r = await (await pedir('/v1/copiar', { id: 'i1', campo: 'password' }, persona)).json();
  assert.equal(r.valor, 'clave-EJEMPLO-ftp');
  assert.equal(D.listarHistorial(db, 1)[0].accion, 'copiar');
});

test('agregar credencial y empresa llaman al vault con la colección correcta', async (t) => {
  const { srv, pedir, persona, vault } = await arrancar(); t.after(() => srv.close());
  assert.equal((await pedir('/v1/credenciales', { empresa: 'VPS', tipo: 'ssh', nombre: 'Servidor nuevo', usuario: 'root', clave: 'x-EJEMPLO-1', url: '10.0.0.9', alias: 'nuevo' }, persona)).status, 200);
  const it = vault.creados[0];
  assert.equal(it.organizationId, 'org-1');
  assert.deepEqual(it.collectionIds, ['c2']);
  assert.equal(it.login.username, 'root');
  assert.deepEqual(it.fields.map((f) => `${f.name}=${f.value}`), ['cape_alias=nuevo', 'cape_tipo=ssh']);
  assert.equal((await pedir('/v1/empresas', { nombre: 'Cliente Nuevo' }, persona)).status, 200);
  assert.deepEqual(vault.creados[1], { org: 'org-1', nombre: 'Cliente Nuevo' });
});

test('CORS solo para la app (tauri) y entrar con datos malos → 401', async (t) => {
  const { srv, pedir } = await arrancar(); t.after(() => srv.close());
  const ok = await pedir('/salud', null, null, { Origin: 'tauri://localhost' });
  assert.equal(ok.headers.get('access-control-allow-origin'), 'tauri://localhost');
  const otro = await pedir('/salud', null, null, { Origin: 'https://malo.example' });
  assert.equal(otro.headers.get('access-control-allow-origin'), null);
  assert.equal((await pedir('/v1/personas/entrar', { correo: 'g@e.co', clave: 'mala', totp: '000000' })).status, 401);
});

test('ftp: el servidor rechaza rutas fuera de la raíz aunque la acción no valide', async (t) => {
  const db = D.abrir(':memory:');
  const items = [{ id: 'f', type: 1, name: 'FTP', collectionIds: ['c1'], login: { username: 'u', password: 'p-EJEMPLO-1' },
    fields: [{ name: 'cape_alias', value: 'club' }, { name: 'cape_tipo', value: 'ftp' }, { name: 'cape_raiz', value: '/ejemplo.com/' }] }];
  let llamadas = 0;
  const srv = crearServidor({ db, vault: { colecciones: async () => COL, items: async () => items },
    acciones: { ftpSubir: async () => { llamadas++; return { sha: 'x' }; } } });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); t.after(() => srv.close());
  const s = D.crearSolicitud(db, 'X', Date.now()); D.aprobar(db, s.codigo, ['Club'], Date.now());
  const { token } = D.sondear(db, s.id, s.sondeo, Date.now());
  const r = await fetch(`http://127.0.0.1:${srv.address().port}/v1/ftp/subir`, { method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ alias: 'club', ruta: '/otro.com/x.js', contenido: 'aG9sYQ==' }) });
  assert.equal(r.status, 400);
  assert.equal(llamadas, 0);
});

test('una persona invita a otra; un Claude no puede invitar', async (t) => {
  const { db, srv, pedir, persona } = await arrancar(); t.after(() => srv.close());
  const r = await (await pedir('/v1/personas/invitar', { correo: 'david@e.co', nombre: 'David' }, persona)).json();
  assert.match(r.codigo, /^[A-Z0-9]{8}$/);
  assert.ok(P.completarAlta(db, 'david@e.co', r.codigo, 'clave-de-david-1', Date.now()).startsWith('otpauth://'));
  assert.equal((await pedir('/v1/personas/invitar', { correo: 'x' }, persona)).status, 400);
  const sol = D.crearSolicitud(db, 'X', Date.now()); D.aprobar(db, sol.codigo, ['Club'], Date.now());
  const { token } = D.sondear(db, sol.id, sol.sondeo, Date.now());
  assert.equal((await pedir('/v1/personas/invitar', { correo: 'yo@e.co' }, token)).status, 403);
});

test('invitar manda el correo con el código y la dirección de la Puerta; si el correo falla, igual da el código', async (t) => {
  const db = D.abrir(':memory:');
  const codigo = P.crearAlta(db, 'g@e.co', 'Gestor', T);
  const s = new URL(P.completarAlta(db, 'g@e.co', codigo, 'clave-del-gestor-123', T)).searchParams.get('secret');
  P.confirmarTotp(db, 'g@e.co', P.totp(s, T), T);
  const enviados = []; let falla = false;
  const srv = crearServidor({ db, vault: vaultFalso(), acciones: {}, repo: 'https://github.com/ejemplo/repo',
    correoSaliente: async (para, asunto, html) => { if (falla) throw new Error('caído'); enviados.push({ para, asunto, html }); } });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r)); t.after(() => srv.close());
  const base = `http://127.0.0.1:${srv.address().port}`;
  const post = (ruta, datos, token) => fetch(base + ruta, { method: 'POST', body: new URLSearchParams(datos),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  const { token } = await (await post('/v1/personas/entrar', { correo: 'g@e.co', clave: 'clave-del-gestor-123', totp: P.totp(s, Date.now()), equipo: 'Mac' })).json();
  const r = await (await post('/v1/personas/invitar', { correo: 'david@e.co', nombre: 'David' }, token)).json();
  assert.equal(r.enviado, true);
  assert.equal(enviados[0].para, 'david@e.co');
  assert.ok(enviados[0].html.includes(r.codigo) && enviados[0].html.includes(base.replace('http://', 'https://')) && enviados[0].html.includes('github.com/ejemplo/repo'));
  falla = true;
  const r2 = await (await post('/v1/personas/invitar', { correo: 'ana@e.co', nombre: '<b>Ana</b>' }, token)).json();
  assert.equal(r2.enviado, false);
  assert.match(r2.codigo, /^[A-Z0-9]{8}$/);
});
