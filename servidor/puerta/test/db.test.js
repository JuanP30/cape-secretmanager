import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/db.js';

const T0 = 1_000_000;

test('código: formato XXX-XXX sin caracteres ambiguos', () => {
  const db = D.abrir(':memory:');
  const s = D.crearSolicitud(db, 'Mac de prueba', T0);
  assert.match(s.codigo, /^[A-HJKMNP-Z2-9]{3}-[A-HJKMNP-Z2-9]{3}$/);
});

test('aprobar entrega el token UNA vez y la sesión queda usable', () => {
  const db = D.abrir(':memory:');
  const s = D.crearSolicitud(db, 'Mac', T0);
  assert.deepEqual(D.sondear(db, s.id, s.sondeo, T0), { estado: 'pendiente' });
  assert.equal(D.aprobar(db, s.codigo, ['Club', 'VPS'], T0 + 1000), true);
  const r = D.sondear(db, s.id, s.sondeo, T0 + 2000);
  assert.equal(r.estado, 'aprobada');
  assert.equal(r.token.length, 64);
  assert.deepEqual(D.sondear(db, s.id, s.sondeo, T0 + 3000), { estado: 'aprobada' }); // ya no lo repite
  const ses = D.sesionPorToken(db, r.token);
  assert.equal(ses.tipo, 'claude');
  assert.deepEqual(ses.empresas, ['Club', 'VPS']);
});

test('sondeo con secreto equivocado no revela nada', () => {
  const db = D.abrir(':memory:');
  const s = D.crearSolicitud(db, 'Mac', T0);
  D.aprobar(db, s.codigo, ['Club'], T0);
  assert.deepEqual(D.sondear(db, s.id, 'otro', T0), { estado: 'desconocida' });
});

test('vencido a los 300 s: ni se aprueba ni entrega token', () => {
  const db = D.abrir(':memory:');
  const s = D.crearSolicitud(db, 'Mac', T0);
  assert.equal(D.aprobar(db, s.codigo, ['Club'], T0 + 301_000), false);
  assert.deepEqual(D.sondear(db, s.id, s.sondeo, T0 + 301_000), { estado: 'vencida' });
});

test('rechazar y revocar', () => {
  const db = D.abrir(':memory:');
  const a = D.crearSolicitud(db, 'A', T0);
  assert.equal(D.rechazar(db, a.codigo), true);
  assert.deepEqual(D.sondear(db, a.id, a.sondeo, T0), { estado: 'rechazada' });
  const b = D.crearSolicitud(db, 'B', T0);
  D.aprobar(db, b.codigo, ['Club'], T0);
  const { token } = D.sondear(db, b.id, b.sondeo, T0);
  const ses = D.sesionPorToken(db, token);
  assert.equal(D.revocar(db, ses.id), true);
  assert.equal(D.sesionPorToken(db, token), null);
});

test('historial guarda y lista lo último primero', () => {
  const db = D.abrir(':memory:');
  D.registrar(db, 1, 'ssh', 'vps', true, 'docker ps');
  D.registrar(db, 1, 'api', 'n8n', false, 'GET /x');
  const h = D.listarHistorial(db, 10);
  assert.equal(h.length, 2);
  assert.equal(h[0].accion, 'api');
});
