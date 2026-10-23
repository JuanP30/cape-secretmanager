import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as D from '../src/db.js';
import * as P from '../src/personas.js';

test('admin da de alta a una persona; ya no puede aprobar Claudes', () => {
  const ruta = join(mkdtempSync(join(tmpdir(), 'puerta-')), 'p.db');
  D.abrir(ruta);
  const correr = (...a) => execFileSync('node', ['admin.js', ...a], { env: { ...process.env, PUERTA_DB: ruta, NODE_NO_WARNINGS: '1' } }).toString();
  const salida = correr('alta', 'g@e.co', 'Gestor');
  const codigo = salida.match(/vale 24 h\): ([A-Z0-9]{8})/)[1];
  assert.match(correr('personas'), /g@e\.co\s+Gestor\s+pendiente/);
  assert.ok(P.completarAlta(D.abrir(ruta), 'g@e.co', codigo, 'clave-suficiente', Date.now()).startsWith('otpauth://'));
  assert.match(correr('aprobar', 'ABC-DEF', 'Club'), /^Comandos:/); // el comando ya no existe
});
