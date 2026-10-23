// Rutas de la Puerta. A un Claude ninguna le devuelve un valor secreto: solo nombres, alias y salidas
// ya tapadas. Las rutas del panel (copiar, aprobar, agregar…) exigen una sesión de PERSONA (clave + 2FA).
import http from 'node:http';
import * as D from './db.js';
import * as P from './personas.js';
import { credencialesDe, buscarAlias, campo } from './vault.js';
import { rutaFtpValida } from './acciones.js';

const MAX_CUERPO = 8_000_000; // ftp/subir manda archivos en base64
const ORIGENES_APP = new Set(['tauri://localhost', 'http://tauri.localhost']);

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    let b = '';
    req.on('data', (c) => { b += c; if (b.length > MAX_CUERPO) { reject(new Error('cuerpo grande')); req.destroy(); } });
    req.on('end', () => resolve(Object.fromEntries(new URLSearchParams(b))));
  });
}
const enviar = (res, estado, cuerpo, extra = {}) => {
  const json = typeof cuerpo !== 'string' && !Buffer.isBuffer(cuerpo);
  const tipo = json ? 'application/json' : Buffer.isBuffer(cuerpo) ? 'application/octet-stream' : 'text/plain; charset=utf-8';
  res.writeHead(estado, { 'Content-Type': tipo, ...extra });
  res.end(json ? JSON.stringify(cuerpo) : cuerpo);
};

export function crearServidor({ db, vault, acciones, ahora = () => Date.now() }) {
  async function credencialDe(sesion, alias, tipo) {
    const item = buscarAlias(await vault.items(), await vault.colecciones(), sesion.empresas, alias);
    if (!item) return { error: [404, `no hay una credencial «${alias}» en tus empresas\n`] };
    if (campo(item, 'cape_tipo') !== tipo) return { error: [400, `«${alias}» no es de tipo ${tipo}\n`] };
    return { item };
  }

  async function panel() {
    const cols = await vault.colecciones();
    const nombreCol = Object.fromEntries(cols.map((c) => [c.id, c.nombre]));
    const credenciales = (await vault.items()).filter((i) => i.type === 1).map((i) => ({
      id: i.id, nombre: i.name, empresa: nombreCol[(i.collectionIds || [])[0]] || '—',
      usuario: i.login?.username || '', url: i.login?.uris?.[0]?.uri || '',
      alias: campo(i, 'cape_alias') || '', tipo: campo(i, 'cape_tipo') || '',
    }));
    return {
      empresas: [...new Set(cols.map((c) => c.nombre))].sort(),
      credenciales,
      solicitudes: D.listarSolicitudes(db, ahora()),
      sesiones: D.listarSesiones(db).filter((s) => !s.revocada),
      historial: D.listarHistorial(db, 20),
    };
  }

  return http.createServer(async (req, res) => {
    try {
      if (ORIGENES_APP.has(req.headers.origin)) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
        if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
      }
      const ruta = new URL(req.url, 'http://x').pathname;
      if (req.method === 'GET' && ruta === '/salud') return enviar(res, 200, 'ok\n');

      // ── Vinculación de un Claude (público: sin aprobación no da nada) ──
      if (req.method === 'POST' && ruta === '/v1/conectar') {
        if (D.listarSolicitudes(db, ahora()).length >= 20) return enviar(res, 429, 'demasiadas solicitudes pendientes\n');
        const { equipo = 'sin nombre' } = await leerCuerpo(req);
        return enviar(res, 200, { ...D.crearSolicitud(db, equipo, ahora()), vence_en: 300 });
      }
      if (req.method === 'POST' && ruta === '/v1/conectar/estado') {
        const { id, sondeo } = await leerCuerpo(req);
        return enviar(res, 200, D.sondear(db, id, sondeo, ahora()));
      }

      // ── Personas: alta con código de un solo uso, confirmación del 2FA y entrada ──
      if (req.method === 'POST' && ruta === '/v1/personas/alta') {
        const { correo, codigo, clave } = await leerCuerpo(req);
        try { return enviar(res, 200, { otpauth: P.completarAlta(db, correo, codigo, clave, ahora()) }); }
        catch (e) { return enviar(res, 400, { error: e.message }); }
      }
      if (req.method === 'POST' && ruta === '/v1/personas/confirmar') {
        const { correo, totp } = await leerCuerpo(req);
        return P.confirmarTotp(db, correo, totp, ahora()) ? enviar(res, 200, { ok: true }) : enviar(res, 400, { error: 'código incorrecto' });
      }
      if (req.method === 'POST' && ruta === '/v1/personas/entrar') {
        const { correo, clave, totp, equipo = 'sin nombre' } = await leerCuerpo(req);
        const r = P.entrar(db, correo, clave, totp, equipo, ahora());
        return r.token ? enviar(res, 200, r) : enviar(res, 401, r);
      }

      const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
      const sesion = token && D.sesionPorToken(db, token);
      if (!sesion) return enviar(res, 401, 'sin sesión: corre «cape conectar»\n');
      const esPersona = sesion.tipo === 'persona';
      const soloPersona = () => enviar(res, 403, 'solo una persona (clave + 2FA) puede hacer esto\n');

      // ── Panel (solo personas) ──
      if (req.method === 'GET' && ruta === '/v1/panel') return esPersona ? enviar(res, 200, await panel()) : soloPersona();
      if (req.method === 'POST' && ruta === '/v1/copiar') {
        if (!esPersona) return soloPersona();
        const { id, campo: c = 'password' } = await leerCuerpo(req);
        const item = (await vault.items()).find((i) => i.id === id);
        if (!item) return enviar(res, 404, { error: 'no existe' });
        const valor = c === 'username' ? item.login?.username : item.login?.password;
        D.registrar(db, sesion.id, 'copiar', item.name, Boolean(valor), c);
        return enviar(res, 200, { valor: valor || '' });
      }
      if (req.method === 'POST' && ruta === '/v1/aprobar') {
        if (!esPersona) return soloPersona();
        const { codigo, empresas = '' } = await leerCuerpo(req);
        const lista = empresas.split(',').map((x) => x.trim()).filter(Boolean);
        if (!lista.length) return enviar(res, 400, { error: 'marca al menos una empresa' });
        const ok = D.aprobar(db, codigo, lista, ahora());
        D.registrar(db, sesion.id, 'aprobar', codigo, ok, lista.join(','));
        return ok ? enviar(res, 200, { ok: true }) : enviar(res, 404, { error: 'no hay una solicitud pendiente con ese código' });
      }
      if (req.method === 'POST' && ruta === '/v1/personas/invitar') {
        if (!esPersona) return soloPersona();
        const { correo, nombre = '' } = await leerCuerpo(req);
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(correo))) return enviar(res, 400, { error: 'correo inválido' });
        const codigo = P.crearAlta(db, correo, nombre || correo, ahora());
        D.registrar(db, sesion.id, 'invitar', correo, true, nombre);
        return enviar(res, 200, { codigo, vence_horas: 24 });
      }
      if (req.method === 'POST' && ruta === '/v1/rechazar') {
        if (!esPersona) return soloPersona();
        const { codigo } = await leerCuerpo(req);
        return enviar(res, 200, { ok: D.rechazar(db, codigo) });
      }
      if (req.method === 'POST' && ruta === '/v1/sesiones/desconectar') {
        if (!esPersona) return soloPersona();
        const { id } = await leerCuerpo(req);
        const ok = D.revocar(db, id);
        D.registrar(db, sesion.id, 'desconectar', `sesión ${id}`, ok, '');
        return enviar(res, 200, { ok });
      }
      if (req.method === 'POST' && ruta === '/v1/credenciales') {
        if (!esPersona) return soloPersona();
        const { empresa, tipo = '', nombre, usuario = '', clave = '', url = '', alias = '' } = await leerCuerpo(req);
        const col = (await vault.colecciones()).find((c) => c.nombre === empresa);
        if (!col || !nombre) return enviar(res, 400, { error: 'falta la empresa o el nombre' });
        const fields = alias && tipo ? [{ name: 'cape_alias', value: alias, type: 0 }, { name: 'cape_tipo', value: tipo, type: 0 }] : [];
        const r = await vault.crearItem({ organizationId: await vault.organizacion(), collectionIds: [col.id], type: 1, name: nombre,
          notes: null, favorite: false, fields, login: { username: usuario, password: clave, uris: url ? [{ match: null, uri: url }] : [] } });
        D.registrar(db, sesion.id, 'agregar', nombre, true, empresa);
        return enviar(res, 200, { id: r?.id });
      }
      if (req.method === 'POST' && ruta === '/v1/empresas') {
        if (!esPersona) return soloPersona();
        const { nombre } = await leerCuerpo(req);
        if (!nombre) return enviar(res, 400, { error: 'falta el nombre' });
        const r = await vault.crearColeccion(await vault.organizacion(), nombre);
        D.registrar(db, sesion.id, 'empresa', nombre, true, '');
        return enviar(res, 200, { id: r?.id });
      }

      // ── Acciones (Claude y personas) ──
      if (req.method === 'GET' && ruta === '/v1/credenciales') {
        const lista = credencialesDe(await vault.items(), await vault.colecciones(), sesion.empresas);
        return enviar(res, 200, lista.map((c) => `${c.alias}\t${c.tipo}\t${c.empresa}\t${c.nombre}`).join('\n') + '\n');
      }
      if (req.method === 'POST' && ruta === '/v1/desconectar') { D.revocar(db, sesion.id); return enviar(res, 200, 'ok\n'); }
      if (req.method === 'POST' && ruta === '/v1/ssh') {
        const { alias, comando = '' } = await leerCuerpo(req);
        const { item, error } = await credencialDe(sesion, alias, 'ssh');
        if (error) return enviar(res, ...error);
        const r = await acciones.ejecutarSsh(item, comando);
        D.registrar(db, sesion.id, 'ssh', alias, r.codigo === 0, comando);
        return enviar(res, 200, r.salida, { 'X-Cape-Codigo': String(r.codigo) });
      }
      if (req.method === 'POST' && ruta === '/v1/api') {
        const { alias, metodo = 'GET', ruta: r2 = '/', cuerpo = '' } = await leerCuerpo(req);
        const { item, error } = await credencialDe(sesion, alias, 'api');
        if (error) return enviar(res, ...error);
        const r = await acciones.llamarApi(item, metodo, r2, cuerpo);
        D.registrar(db, sesion.id, 'api', alias, r.estado < 400, `${metodo} ${r2}`);
        return enviar(res, 200, r.salida, { 'X-Cape-Codigo': String(r.estado) });
      }
      if (req.method === 'POST' && ruta === '/v1/ftp/bajar') {
        const { alias, ruta: rr } = await leerCuerpo(req);
        const { item, error } = await credencialDe(sesion, alias, 'ftp');
        if (error) return enviar(res, ...error);
        try {
          rutaFtpValida(item, rr); // segunda barrera: también la valida la acción
          const b = await acciones.ftpBajar(item, rr);
          D.registrar(db, sesion.id, 'ftp-bajar', alias, Boolean(b), rr);
          return b ? enviar(res, 200, b) : enviar(res, 404, 'no existe en el servidor\n');
        } catch (e) { return enviar(res, 400, `${e.message}\n`); }
      }
      if (req.method === 'POST' && ruta === '/v1/ftp/subir') {
        const { alias, ruta: rr, contenido = '' } = await leerCuerpo(req);
        const { item, error } = await credencialDe(sesion, alias, 'ftp');
        if (error) return enviar(res, ...error);
        try {
          rutaFtpValida(item, rr);
          const r = await acciones.ftpSubir(item, rr, Buffer.from(contenido, 'base64'));
          D.registrar(db, sesion.id, 'ftp-subir', alias, true, rr);
          return enviar(res, 200, r);
        } catch (e) { D.registrar(db, sesion.id, 'ftp-subir', alias, false, rr); return enviar(res, 400, `${e.message}\n`); }
      }
      return enviar(res, 404, 'ruta desconocida\n');
    } catch (e) {
      return enviar(res, 500, `error: ${e.message}\n`);
    }
  });
}
