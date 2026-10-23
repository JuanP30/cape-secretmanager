// Personas (administrador y equipo): contraseña con scrypt + código de 6 dígitos (TOTP, RFC 6238) hecho con
// node:crypto, sin dependencias. Solo una sesión de persona puede aprobar Claudes y copiar claves.
import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto';
import { huella } from './db.js';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VIDA_ALTA_MS = 24 * 3600_000;
const BLOQUEO_MS = 15 * 60_000;
const MAX_FALLOS = 5;

function aBase32(buf) {
  let bits = '', s = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  for (let i = 0; i < bits.length; i += 5) s += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)];
  return s;
}
function desdeBase32(s) {
  const bits = [...String(s).replace(/=+$/, '').toUpperCase()].map((c) => B32.indexOf(c).toString(2).padStart(5, '0')).join('');
  return Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
}

export function totp(secreto, tiempoMs, paso = 30) {
  const contador = Buffer.alloc(8);
  contador.writeBigUInt64BE(BigInt(Math.floor(tiempoMs / 1000 / paso)));
  const h = createHmac('sha1', desdeBase32(secreto)).update(contador).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}
// Acepta el paso actual y los vecinos (±30 s) por relojes un poco desfasados.
// Acepta «123 456» o «123456»: las apps muestran el código partido en dos.
export const verificarTotp = (secreto, codigo, tiempoMs) =>
  [-1, 0, 1].some((d) => totp(secreto, tiempoMs + d * 30_000) === String(codigo).replace(/\s+/g, ''));

export function hashClave(clave) {
  const sal = randomBytes(16);
  return `scrypt$${sal.toString('hex')}$${scryptSync(String(clave), sal, 32).toString('hex')}`;
}
export function verificarClave(clave, guardado) {
  const [, sal, h] = String(guardado).split('$');
  if (!sal || !h) return false;
  const a = scryptSync(String(clave), Buffer.from(sal, 'hex'), 32);
  return timingSafeEqual(a, Buffer.from(h, 'hex'));
}

const persona = (db, correo) => db.prepare('SELECT * FROM personas WHERE correo=?').get(String(correo).trim().toLowerCase());

// El gestor da de alta a alguien (admin.js alta): sale un código de un solo uso que vale 24 h.
export function crearAlta(db, correo, nombre, ahora) {
  const codigo = Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  db.prepare(`INSERT INTO personas(correo,nombre,alta_codigo,alta_vence,activa) VALUES (?,?,?,?,0)
    ON CONFLICT(correo) DO UPDATE SET nombre=excluded.nombre, clave=NULL, totp=NULL, alta_codigo=excluded.alta_codigo,
    alta_vence=excluded.alta_vence, activa=0, fallos=0, bloqueada_hasta=0`)
    .run(String(correo).trim().toLowerCase(), nombre, huella(codigo), ahora + VIDA_ALTA_MS);
  return codigo;
}

// La persona pone su clave con el código; recibe el enlace otpauth:// para su app de códigos.
export function completarAlta(db, correo, codigo, clave, ahora) {
  const p = persona(db, correo);
  if (!p || p.alta_codigo !== huella(String(codigo).trim().toUpperCase()) || p.alta_vence < ahora)
    throw new Error('código de alta inválido o vencido');
  if (String(clave).length < 10) throw new Error('la contraseña debe tener al menos 10 caracteres');
  const secreto = aBase32(randomBytes(20));
  db.prepare('UPDATE personas SET clave=?, totp=? WHERE id=?').run(hashClave(clave), secreto, p.id);
  const etiqueta = encodeURIComponent(`CAPE SecretManager:${p.correo}`);
  return `otpauth://totp/${etiqueta}?secret=${secreto}&issuer=${encodeURIComponent('CAPE SecretManager')}`;
}

export function confirmarTotp(db, correo, codigo, ahora) {
  const p = persona(db, correo);
  if (!p || !p.totp || p.activa || !verificarTotp(p.totp, codigo, ahora)) return false;
  db.prepare('UPDATE personas SET activa=1, alta_codigo=NULL WHERE id=?').run(p.id);
  return true;
}

export function entrar(db, correo, clave, codigo, equipo, ahora) {
  const p = persona(db, correo);
  if (!p || !p.activa) return { error: 'datos incorrectos' };
  if (p.bloqueada_hasta > ahora) return { error: 'cuenta bloqueada 15 minutos por intentos fallidos' };
  if (!verificarClave(clave, p.clave) || !verificarTotp(p.totp, codigo, ahora)) {
    const fallos = p.fallos + 1;
    db.prepare('UPDATE personas SET fallos=?, bloqueada_hasta=? WHERE id=?')
      .run(fallos >= MAX_FALLOS ? 0 : fallos, fallos >= MAX_FALLOS ? ahora + BLOQUEO_MS : 0, p.id);
    return { error: fallos >= MAX_FALLOS ? 'cuenta bloqueada 15 minutos por intentos fallidos' : 'datos incorrectos' };
  }
  db.prepare('UPDATE personas SET fallos=0, bloqueada_hasta=0 WHERE id=?').run(p.id);
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sesiones(huella,tipo,equipo,empresas,creada) VALUES (?,?,?,?,?)')
    .run(huella(token), 'persona', `${p.correo} · ${String(equipo).slice(0, 60)}`, '["*"]', new Date(ahora).toISOString());
  return { token };
}

export const listarPersonas = (db) => db.prepare('SELECT correo,nombre,activa FROM personas ORDER BY id').all();
