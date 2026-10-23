import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campo, credencialesDe, buscarAlias, secretosDe, crearVault } from '../src/vault.js';

const COL = [{ id: 'c1', nombre: 'Club' }, { id: 'c2', nombre: 'VPS' }];
const VPS = { name: 'VPS Hostinger — acceso', collectionIds: ['c2'],
  login: { username: 'root', password: 'clave-EJEMPLO-vps', uris: [{ uri: '10.0.0.1' }] },
  fields: [{ name: 'cape_alias', value: 'vps' }, { name: 'cape_tipo', value: 'ssh' },
           { name: 'API Token Hostinger', value: 'tok-EJEMPLO-999', type: 1 }] };
const FTP = { name: 'FTP Club', collectionIds: ['c1'], login: { password: 'x' }, fields: [] }; // sin cape_alias
const ITEMS = [VPS, FTP];

test('campo lee campos personalizados', () => {
  assert.equal(campo(VPS, 'cape_tipo'), 'ssh');
  assert.equal(campo(VPS, 'no-existe'), undefined);
});

test('solo se listan credenciales marcadas y de las empresas de la sesión', () => {
  assert.deepEqual(credencialesDe(ITEMS, COL, ['VPS']),
    [{ alias: 'vps', tipo: 'ssh', nombre: 'VPS Hostinger — acceso', empresa: 'VPS' }]);
  assert.deepEqual(credencialesDe(ITEMS, COL, ['Club']), []);
});

test('buscarAlias respeta las empresas', () => {
  assert.equal(buscarAlias(ITEMS, COL, ['VPS'], 'vps'), VPS);
  assert.equal(buscarAlias(ITEMS, COL, ['Club'], 'vps'), null);
});

test('secretosDe junta contraseña y campos ocultos (para taparlos)', () => {
  assert.deepEqual(secretosDe(VPS).sort(), ['clave-EJEMPLO-vps', 'tok-EJEMPLO-999']);
});

test('crearVault desenvuelve la respuesta de bw serve', async () => {
  const fake = async (url) => ({ json: async () => url.endsWith('/list/object/collections')
    ? { success: true, data: { data: [{ id: 'c1', name: 'Club' }] } }
    : { success: false } });
  const v = crearVault('http://x', fake);
  assert.deepEqual(await v.colecciones(), [{ id: 'c1', nombre: 'Club' }]);
  await assert.rejects(v.items(), /vault/);
});

test('colecciones anidadas: la empresa es la última parte del nombre', async () => {
  const fake = async () => ({ json: async () => ({ success: true, data: { data: [{ id: 'c9', name: 'Default collection/VPS' }] } }) });
  assert.deepEqual(await crearVault('http://x', fake).colecciones(), [{ id: 'c9', nombre: 'VPS' }]);
});

test('empresas ["*"] (sesión de persona) ve todas las colecciones', () => {
  assert.equal(buscarAlias(ITEMS, COL, ['*'], 'vps'), VPS);
});
