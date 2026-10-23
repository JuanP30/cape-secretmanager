import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearCorreo, armarMime, correoInvitacion } from '../src/correo.js';

test('sin webhook no hay correo; con webhook manda el MIME en base64url con la clave', async () => {
  assert.equal(crearCorreo({ url: '' }), null);
  let pedido;
  const enviar = crearCorreo({ url: 'http://n8n/x', clave: 'k-EJEMPLO', fetchFn: async (u, o) => { pedido = { u, o }; return { ok: true }; } });
  await enviar('a@b.co', 'Hola ñ', '<p>hola</p>');
  assert.equal(pedido.o.headers['X-Vault-Key'], 'k-EJEMPLO');
  const mime = Buffer.from(JSON.parse(pedido.o.body).raw, 'base64url').toString();
  assert.ok(mime.startsWith('To: a@b.co\r\nSubject: =?UTF-8?B?'));
  assert.equal(mime, armarMime('a@b.co', 'Hola ñ', '<p>hola</p>'));
  const falla = crearCorreo({ url: 'http://n8n/x', fetchFn: async () => ({ ok: false, status: 500 }) });
  await assert.rejects(falla('a@b.co', 'x', 'y'), /500/);
});

test('la invitación escapa el nombre', () => {
  const html = correoInvitacion({ nombre: '<script>', correo: 'a@b.co', codigo: 'ABCD2345', puerta: 'https://p.x', repo: '' });
  assert.ok(!html.includes('<script>') && html.includes('&#60;script&#62;') && html.includes('ABCD2345'));
});
