import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../src/db.js';
import * as P from '../src/personas.js';

const T0 = 1_700_000_000_000;

test('TOTP: vector oficial RFC 6238 (SHA-1, t=59 s → 287082)', () => {
  assert.equal(P.totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000), '287082');
  assert.ok(P.verificarTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000 + 25_000)); // paso vecino
  assert.ok(!P.verificarTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', '287082', 59_000 + 120_000));
});

test('clave: scrypt verifica la buena y rechaza la mala', () => {
  const g = P.hashClave('una clave larga');
  assert.match(g, /^scrypt\$/);
  assert.ok(P.verificarClave('una clave larga', g));
  assert.ok(!P.verificarClave('otra clave', g));
  assert.ok(!P.verificarClave('x', 'basura'));
});

function altaCompleta(db, correo = 'gestor@ejemplo.com') {
  const codigo = P.crearAlta(db, correo, 'Gestor', T0);
  const uri = P.completarAlta(db, correo, codigo, 'clave-del-gestor-123', T0);
  const secreto = new URL(uri).searchParams.get('secret');
  assert.ok(P.confirmarTotp(db, correo, P.totp(secreto, T0), T0));
  return secreto;
}

test('alta completa y entrada con clave + 6 dígitos', () => {
  const db = D.abrir(':memory:');
  const secreto = altaCompleta(db);
  const r = P.entrar(db, 'gestor@ejemplo.com', 'clave-del-gestor-123', P.totp(secreto, T0), 'Mac', T0);
  assert.equal(r.token.length, 64);
  const ses = D.sesionPorToken(db, r.token);
  assert.equal(ses.tipo, 'persona');
  assert.deepEqual(ses.empresas, ['*']);
});

test('alta: código equivocado, vencido o clave corta → no avanza', () => {
  const db = D.abrir(':memory:');
  const codigo = P.crearAlta(db, 'a@b.co', 'A', T0);
  assert.throws(() => P.completarAlta(db, 'a@b.co', 'MALO', 'clave-suficiente', T0), /código/);
  assert.throws(() => P.completarAlta(db, 'a@b.co', codigo, 'corta', T0), /10/);
  assert.throws(() => P.completarAlta(db, 'a@b.co', codigo, 'clave-suficiente', T0 + 25 * 3600_000), /código/);
});

test('sin confirmar el código de la app no se puede entrar', () => {
  const db = D.abrir(':memory:');
  const codigo = P.crearAlta(db, 'a@b.co', 'A', T0);
  const uri = P.completarAlta(db, 'a@b.co', codigo, 'clave-suficiente', T0);
  const s = new URL(uri).searchParams.get('secret');
  assert.ok(P.entrar(db, 'a@b.co', 'clave-suficiente', P.totp(s, T0), 'Mac', T0).error);
});

test('clave o 6 dígitos equivocados → error; 5 fallos → bloqueo 15 min', () => {
  const db = D.abrir(':memory:');
  const s = altaCompleta(db);
  assert.ok(P.entrar(db, 'gestor@ejemplo.com', 'mala', P.totp(s, T0), 'Mac', T0).error);
  assert.ok(P.entrar(db, 'gestor@ejemplo.com', 'clave-del-gestor-123', '000000', 'Mac', T0).error);
  for (let i = 0; i < 3; i++) P.entrar(db, 'gestor@ejemplo.com', 'mala', '000000', 'Mac', T0);
  const bloqueada = P.entrar(db, 'gestor@ejemplo.com', 'clave-del-gestor-123', P.totp(s, T0), 'Mac', T0);
  assert.match(bloqueada.error, /bloquead/);
  const despues = T0 + 16 * 60_000;
  assert.ok(P.entrar(db, 'gestor@ejemplo.com', 'clave-del-gestor-123', P.totp(s, despues), 'Mac', despues).token);
});

test('el código se acepta con un espacio en medio', () => {
  const c = P.totp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 59_000);
  assert.ok(P.verificarTotp('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', `${c.slice(0, 3)} ${c.slice(3)}`, 59_000));
});
