// Estado de la Puerta: solicitudes de vinculación, sesiones e historial (SQLite de Node, sin dependencias).
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const VIDA_MS = 300_000;
export const huella = (s) => createHash('sha256').update(String(s)).digest('hex');
const codigoNuevo = () => {
  const c = Array.from({ length: 6 }, () => ALFABETO[randomInt(ALFABETO.length)]).join('');
  return `${c.slice(0, 3)}-${c.slice(3)}`;
};

export function abrir(ruta) {
  const db = new DatabaseSync(ruta);
  db.exec(`
    CREATE TABLE IF NOT EXISTS solicitudes(id TEXT PRIMARY KEY, codigo TEXT, equipo TEXT, sondeo TEXT,
      estado TEXT, vence INTEGER, token TEXT);
    CREATE TABLE IF NOT EXISTS sesiones(id INTEGER PRIMARY KEY, huella TEXT UNIQUE, tipo TEXT, equipo TEXT,
      empresas TEXT, creada TEXT, revocada TEXT);
    CREATE TABLE IF NOT EXISTS historial(id INTEGER PRIMARY KEY, fecha TEXT, sesion_id INTEGER, accion TEXT,
      destino TEXT, ok INTEGER, detalle TEXT);
    CREATE TABLE IF NOT EXISTS personas(id INTEGER PRIMARY KEY, correo TEXT UNIQUE, nombre TEXT, clave TEXT,
      totp TEXT, alta_codigo TEXT, alta_vence INTEGER, activa INTEGER DEFAULT 0, fallos INTEGER DEFAULT 0,
      bloqueada_hasta INTEGER DEFAULT 0);`);
  return db;
}

export function crearSolicitud(db, equipo, ahora) {
  const s = { id: randomUUID(), codigo: codigoNuevo(), sondeo: randomBytes(16).toString('hex') };
  db.prepare('INSERT INTO solicitudes VALUES (?,?,?,?,?,?,NULL)')
    .run(s.id, s.codigo, String(equipo).slice(0, 80), huella(s.sondeo), 'pendiente', ahora + VIDA_MS);
  return s;
}

const pendiente = (db, codigo, ahora) =>
  db.prepare("SELECT * FROM solicitudes WHERE codigo=? AND estado='pendiente' AND vence>=?")
    .get(String(codigo).toUpperCase(), ahora);

export function aprobar(db, codigo, empresas, ahora) {
  const s = pendiente(db, codigo, ahora);
  if (!s) return false;
  const token = randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sesiones(huella,tipo,equipo,empresas,creada) VALUES (?,?,?,?,?)')
    .run(huella(token), 'claude', s.equipo, JSON.stringify(empresas), new Date(ahora).toISOString());
  db.prepare("UPDATE solicitudes SET estado='aprobada', token=? WHERE id=?").run(token, s.id);
  return true;
}

export function rechazar(db, codigo) {
  return db.prepare("UPDATE solicitudes SET estado='rechazada' WHERE codigo=? AND estado='pendiente'")
    .run(String(codigo).toUpperCase()).changes === 1;
}

export function sondear(db, id, sondeo, ahora) {
  const s = db.prepare('SELECT * FROM solicitudes WHERE id=? AND sondeo=?').get(String(id), huella(sondeo));
  if (!s) return { estado: 'desconocida' };
  if (s.estado === 'pendiente' && s.vence < ahora) return { estado: 'vencida' };
  if (s.estado === 'aprobada' && s.token) {
    db.prepare('UPDATE solicitudes SET token=NULL WHERE id=?').run(s.id); // se entrega una sola vez
    return { estado: 'aprobada', token: s.token };
  }
  return { estado: s.estado };
}

export function sesionPorToken(db, token) {
  const s = db.prepare('SELECT * FROM sesiones WHERE huella=? AND revocada IS NULL').get(huella(token));
  return s ? { id: s.id, tipo: s.tipo, equipo: s.equipo, empresas: JSON.parse(s.empresas) } : null;
}

export function revocar(db, id) {
  return db.prepare('UPDATE sesiones SET revocada=? WHERE id=? AND revocada IS NULL')
    .run(new Date().toISOString(), Number(id)).changes === 1;
}

export function registrar(db, sesionId, accion, destino, ok, detalle) {
  db.prepare('INSERT INTO historial(fecha,sesion_id,accion,destino,ok,detalle) VALUES (?,?,?,?,?,?)')
    .run(new Date().toISOString(), sesionId, accion, destino, ok ? 1 : 0, String(detalle).slice(0, 300));
}

export const listarSolicitudes = (db, ahora) =>
  db.prepare("SELECT codigo,equipo,vence FROM solicitudes WHERE estado='pendiente' AND vence>=?").all(ahora);
export const listarSesiones = (db) =>
  db.prepare('SELECT id,tipo,equipo,empresas,creada,revocada FROM sesiones ORDER BY id').all();
export const listarHistorial = (db, n) =>
  db.prepare('SELECT * FROM historial ORDER BY id DESC LIMIT ?').all(n);
