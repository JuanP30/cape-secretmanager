// CAPE SecretManager — panel de la barra. Habla con la Puerta con una sesión de PERSONA (clave + 2FA)
// guardada en el Llavero (comandos Rust token_*). Todo dato que viene del vault se pinta con textContent.
const { invoke } = window.__TAURI__.core;
const notificar = (titulo, cuerpo) => window.__TAURI__.notification?.sendNotification({ title: titulo, body: cuerpo });

const SVG = {
  buscar: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  ftp: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M12 10v6"/><path d="m9 13 3-3 3 3"/>',
  ssh: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  llave: '<path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z"/><circle cx="16.5" cy="7.5" r=".5"/>',
  copiar: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  mas: '<path d="M5 12h14M12 5v14"/>',
  empresa: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/>',
};
const icono = (n) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'i'); s.innerHTML = SVG[n]; return s; };
function h(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v);
  for (const c of hijos.flat()) if (c != null) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
const vista = document.getElementById('vista');
// Cada cambio de pantalla entra con un deslizamiento corto (el CSS lo apaga si «Reducir movimiento»).
const pintar = (...nodos) => { vista.replaceChildren(...nodos.filter((n) => n != null)); vista.classList.remove('cambio'); void vista.offsetWidth; vista.classList.add('cambio'); };
// Animación de entrada cada vez que se abre el panel desde la barra o con ⌘⇧K.
window.__TAURI__.event?.listen('panel-mostrar', () => { document.body.classList.remove('entrando'); void document.body.offsetWidth; document.body.classList.add('entrando'); });

let token = null, datos = null, filtro = '', vistas = new Set();

async function pedir(ruta, campos) {
  const r = await fetch(PUERTA + ruta, {
    method: campos ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(campos ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    body: campos ? new URLSearchParams(campos) : undefined,
  });
  if (r.status === 401) { await salir(); throw new Error('sesión vencida'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `error ${r.status}`);
  return j;
}

// ── Entrar ───────────────────────────────────────────────────────────────────
function vistaEntrar(error = '', correoPrevio = '', aviso = '') {
  document.getElementById('quien').textContent = '';
  const correo = h('input', { type: 'email', placeholder: 'tu@correo.com', autofocus: '', value: correoPrevio });
  const clave = h('input', { type: 'password', placeholder: 'Tu contraseña' });
  const totp = h('input', { inputmode: 'numeric', maxlength: '6', placeholder: '6 dígitos de tu app de códigos' });
  const err = h('div', { class: 'error' }, error);
  const enviar = async () => {
    err.textContent = '';
    const r = await fetch(PUERTA + '/v1/personas/entrar', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ correo: correo.value, clave: clave.value, totp: totp.value, equipo: 'app de la barra' }) });
    const j = await r.json().catch(() => ({}));
    if (!j.token) { err.textContent = j.error === 'datos incorrectos' ? 'Correo, contraseña o código incorrectos.' : (j.error || 'No se pudo entrar.'); return; }
    token = j.token; await invoke('token_guardar', { token }); clave.value = '';
    await cargar();
  };
  totp.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
  pintar(h('div', { class: 'pad' },
    h('div', { class: 'titulo', style: 'padding:0 0 4px' }, 'Entrar'),
    aviso ? h('div', { class: 'pasos', style: 'color:var(--ok);font-weight:600' }, aviso) : null,
    h('label', { class: 'campo' }, 'Correo'), correo,
    h('label', { class: 'campo' }, 'Contraseña'), clave,
    h('label', { class: 'campo' }, 'Código de 6 dígitos'), totp, err,
    h('div', { class: 'acciones', style: 'padding:12px 0 0' }, h('button', { class: 'p', onclick: enviar }, 'Entrar')),
    h('div', { class: 'enlace', onclick: () => vistaAlta() }, 'Primera vez · tengo un código de alta')));
}

// ── Primera vez: clave propia + QR para la app de códigos ────────────────────
function vistaAlta() {
  const correo = h('input', { type: 'email', placeholder: 'tu@correo.com' });
  const codigo = h('input', { placeholder: 'Código de alta (8 letras y números)', style: 'text-transform:uppercase' });
  const c1 = h('input', { type: 'password', placeholder: 'Mínimo 10 caracteres' });
  const c2 = h('input', { type: 'password', placeholder: 'Repítela' });
  const err = h('div', { class: 'error' });
  const volver = h('div', { class: 'titulo' }, 'Primera vez', h('span', { class: 'x', title: 'Volver', onclick: () => vistaEntrar() }, '✕'));
  pintar(volver, h('div', { class: 'pad', style: 'padding-top:4px;overflow:auto' },
    h('div', { class: 'pasos' }, 'Quien te invitó te dio un ', h('b', {}, 'código de alta'), '. Con él eliges tu contraseña y conectas tu app de códigos.'),
    h('label', { class: 'campo' }, 'Correo'), correo, h('label', { class: 'campo' }, 'Código de alta'), codigo,
    h('label', { class: 'campo' }, 'Tu contraseña'), c1, h('label', { class: 'campo' }, 'Repite la contraseña'), c2, err,
    h('div', { class: 'acciones', style: 'padding:12px 0 0' }, h('button', { class: 'p', onclick: async () => {
      if (c1.value !== c2.value) { err.textContent = 'Las contraseñas no coinciden.'; return; }
      const r = await fetch(PUERTA + '/v1/personas/alta', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ correo: correo.value.trim(), codigo: codigo.value.trim().toUpperCase(), clave: c1.value }) });
      const j = await r.json().catch(() => ({}));
      if (!j.otpauth) { err.textContent = j.error || 'No se pudo.'; return; }
      c1.value = c2.value = ''; vistaQr(correo.value.trim(), j.otpauth);
    } }, 'Continuar'))));
}

function vistaQr(correo, uri) {
  const qr = qrcode(0, 'M'); qr.addData(uri); qr.make();
  const caja = h('div', { class: 'qr' }); caja.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); // SVG generado aquí, sin datos externos
  const totp = h('input', { inputmode: 'numeric', placeholder: '6 dígitos (con o sin espacio)' });
  const err = h('div', { class: 'error' });
  const clave = new URL(uri).searchParams.get('secret');
  pintar(h('div', { class: 'titulo' }, 'Escanea con tu app de códigos'), h('div', { class: 'pad', style: 'padding-top:0;overflow:auto' },
    h('div', { class: 'pasos' }, 'Abre tu app de códigos (', h('b', {}, 'Contraseñas'), ' del iPhone, Google o Microsoft Authenticator), toca ', h('b', {}, '+'), ' y escanea:'),
    caja,
    h('details', {}, h('summary', { class: 'pasos', style: 'cursor:pointer' }, '¿No puedes escanear? Clave para escribirla'), h('div', { class: 'clave-manual' }, clave)),
    h('label', { class: 'campo' }, 'Código de 6 dígitos de la cuenta «CAPE SecretManager»'), totp, err,
    h('div', { class: 'acciones', style: 'padding:12px 0 0' }, h('button', { class: 'p', onclick: async () => {
      const r = await fetch(PUERTA + '/v1/personas/confirmar', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ correo, totp: totp.value }) });
      if (!r.ok) { err.textContent = 'Código incorrecto. Usa el de la cuenta nueva «CAPE SecretManager», no el de otra.'; return; }
      vistaEntrar('', correo, 'Listo. Ya puedes entrar con tu contraseña y el código.');
    } }, 'Activar'))));
}

async function salir() {
  if (token) fetch(PUERTA + '/v1/desconectar', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  token = null; datos = null; await invoke('token_borrar'); vistaEntrar();
}

// ── Panel ────────────────────────────────────────────────────────────────────
async function cargar() {
  try { datos = await pedir('/v1/panel'); } catch (e) { return token ? vistaEntrar(e.message) : null; }
  const yo = datos.sesiones.find((s) => s.tipo === 'persona');
  document.getElementById('quien').textContent = yo ? `${yo.equipo.split(' · ')[0]} · Salir` : 'Salir';
  for (const s of datos.solicitudes) if (!vistas.has(s.codigo)) { vistas.add(s.codigo); notificar('Claude pide conexión', `${s.equipo} · ${s.codigo}`); }
  vistaPanel();
}

function vistaPanel() {
  const iconoDe = (c) => c.tipo === 'ftp' ? 'ftp' : c.tipo === 'ssh' ? 'ssh' : 'llave';
  const visibles = datos.credenciales.filter((c) => `${c.nombre} ${c.empresa} ${c.alias} ${c.usuario}`.toLowerCase().includes(filtro));
  const porEmpresa = {};
  for (const c of visibles) (porEmpresa[c.empresa] ||= []).push(c);
  const lista = Object.keys(porEmpresa).sort().flatMap((emp) => [h('div', { class: 'grupo' }, emp), ...porEmpresa[emp].map((c) => {
    const b = h('button', { class: 'btn', title: 'Copia la contraseña (se borra en 30 s)' }, icono('copiar'), 'Copiar');
    b.addEventListener('click', async () => {
      try { const { valor } = await pedir('/v1/copiar', { id: c.id, campo: 'password' }); await invoke('copiar', { texto: valor });
        b.classList.add('hecho'); b.lastChild.textContent = 'Copiada'; setTimeout(() => { b.classList.remove('hecho'); b.lastChild.textContent = 'Copiar'; }, 2500);
      } catch (e) { b.lastChild.textContent = 'Error'; }
    });
    return h('div', { class: 'fila' }, icono(iconoDe(c)),
      h('div', { class: 'n' }, h('b', { title: c.nombre }, c.nombre), h('span', {}, [c.usuario, c.url].filter(Boolean).join(' · ') || ' ')), b);
  })]);
  const buscar = h('input', { placeholder: 'Buscar: ftp club, vps, n8n…', value: filtro });
  buscar.addEventListener('input', () => { filtro = buscar.value.toLowerCase(); const pos = buscar.selectionStart; vistaPanel(); const n = vista.querySelector('.buscar input'); n.focus(); n.setSelectionRange(pos, pos); });

  const ultimo = datos.historial.find((x) => x.accion === 'ftp-subir');
  const claudes = datos.sesiones.filter((s) => s.tipo === 'claude');
  const pendientes = datos.solicitudes;
  pintar(
    h('div', { class: 'buscar' }, icono('buscar'), buscar),
    h('div', { style: 'flex:1;overflow:auto' }, lista.length ? lista : h('div', { class: 'vacio' }, filtro ? 'Nada coincide con la búsqueda.' : 'Aún no hay credenciales.')),
    h('div', { class: 'acciones' },
      h('button', { class: 'p', onclick: vistaAgregar }, icono('mas'), 'Agregar'),
      h('button', { class: 's', onclick: vistaEmpresa }, icono('empresa'), 'Empresa')),
    h('div', { class: 'pie' }, h('span', { class: `punto ${ultimo ? (ultimo.ok ? '' : 'mal') : 'gris'}` }),
      ultimo ? `Último deploy: ${ultimo.detalle.split('/').pop()} · ${hace(ultimo.fecha)}` : 'Sin deploys por la Puerta todavía'),
    h('div', { class: 'pie link', onclick: vistaAccesos }, h('span', { class: `punto ${claudes.length ? '' : 'gris'}` }),
      h('span', { style: `font-weight:600;color:var(--tx)` }, claudes.length ? `${claudes.length} Claude conectado${claudes.length > 1 ? 's' : ''}` : 'Ningún Claude conectado'),
      h('span', { class: 'der' }, 'Accesos ›')),
    pendientes.length ? h('div', { class: 'pie link', onclick: () => vistaSolicitud(pendientes[0]) },
      h('span', { style: 'color:var(--m700);font-weight:700' }, `${pendientes.length} solicitud${pendientes.length > 1 ? 'es' : ''} pendiente${pendientes.length > 1 ? 's' : ''}`),
      h('span', { class: 'der' }, 'Revisar ›')) : null,
  );
}

const hace = (iso) => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return m < 1 ? 'ahora' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
const cabecera = (texto) => h('div', { class: 'titulo' }, texto, h('span', { class: 'x', title: 'Cerrar', onclick: vistaPanel }, '✕'));
function casillas(nombre, opciones, marcadas = [], tipo = 'checkbox') {
  return h('div', { class: 'lista-cb' }, opciones.map((o) => {
    const inp = h('input', { type: tipo, name: nombre, value: o.valor ?? o }); if (marcadas.includes(o.valor ?? o)) inp.checked = true;
    return h('label', {}, inp, h('span', { class: 'cb' }), o.texto ?? o);
  }));
}
const marcadas = (nombre) => [...vista.querySelectorAll(`input[name="${nombre}"]:checked`)].map((i) => i.value);

// ── Solicitud de un Claude ───────────────────────────────────────────────────
function vistaSolicitud(s) {
  const err = h('div', { class: 'error' });
  pintar(cabecera('Claude pide conexión'), h('div', { class: 'pad', style: 'padding-top:6px' },
    h('div', { class: 'ayuda' }, `Equipo «${s.equipo}». Comprueba que el código sea el mismo que muestra ese equipo.`),
    h('div', { class: 'codigo' }, s.codigo),
    h('label', { class: 'campo' }, 'Puede trabajar en'), casillas('emp', datos.empresas), err,
    h('div', { class: 'acciones', style: 'padding:12px 0 0' },
      h('button', { class: 'p', onclick: async () => {
        const emp = marcadas('emp'); if (!emp.length) { err.textContent = 'Marca al menos una empresa.'; return; }
        try { await pedir('/v1/aprobar', { codigo: s.codigo, empresas: emp.join(',') }); await cargar(); } catch (e) { err.textContent = e.message; }
      } }, 'Aprobar conexión'),
      h('button', { class: 's', onclick: async () => { await pedir('/v1/rechazar', { codigo: s.codigo }); await cargar(); } }, 'Rechazar'))));
}

// ── Accesos ──────────────────────────────────────────────────────────────────
function vistaAccesos() {
  const filas = datos.sesiones.map((s) => h('div', { class: 'fila' },
    h('div', { class: 'n' }, h('b', {}, s.equipo), h('span', {}, `${s.tipo === 'claude' ? 'Claude' : 'Persona'} · ${JSON.parse(s.empresas).join(', ').replace('*', 'todas')} · desde ${s.creada.slice(0, 10)}`)),
    h('button', { class: 'btn', onclick: async () => { await pedir('/v1/sesiones/desconectar', { id: s.id }); await cargar(); vistaAccesos(); } }, 'Desconectar')));
  pintar(cabecera('Accesos'), h('div', { style: 'flex:1;overflow:auto' }, filas.length ? filas : h('div', { class: 'vacio' }, 'Nadie conectado.')),
    h('div', { class: 'acciones' }, h('button', { class: 'p', onclick: vistaInvitar }, icono('mas'), 'Invitar persona')),
    h('div', { class: 'pie' }, 'Para conectar un Claude: en su equipo, «bash scripts/cape conectar».'));
}

function vistaInvitar() {
  const correo = h('input', { type: 'email', placeholder: 'correo@de-la-persona.com' });
  const nombre = h('input', { placeholder: 'Nombre' });
  const err = h('div', { class: 'error' });
  const zona = h('div', {});
  pintar(cabecera('Invitar persona'), h('div', { class: 'pad', style: 'padding-top:4px;overflow:auto' },
    h('div', { class: 'pasos' }, 'Le das un código de alta (vale 24 h). Con él, en su app, elige su contraseña y escanea su QR.'),
    h('label', { class: 'campo' }, 'Correo'), correo, h('label', { class: 'campo' }, 'Nombre'), nombre, err,
    h('div', { class: 'acciones', style: 'padding:12px 0 0' }, h('button', { class: 'p', onclick: async () => {
      try {
        const { codigo } = await pedir('/v1/personas/invitar', { correo: correo.value.trim(), nombre: nombre.value.trim() });
        const texto = `Hola ${nombre.value.trim() || ''}: te invité a CAPE SecretManager.\n\n` +
          `1. Construye e instala la app «CAPE SecretManager» (docs/2-app.md del repo) y ábrela.\n` +
          `2. Toca «Primera vez · tengo un código de alta».\n` +
          `3. Correo: ${correo.value.trim()}\n   Código de alta: ${codigo}  (vale 24 horas)\n` +
          `4. Elige tu contraseña, escanea el QR con tu app de códigos y escribe los 6 dígitos.\n` +
          `Guía completa: README del repo cape-secretmanager.`;
        const copiarB = h('button', { class: 's', onclick: async () => { await invoke('copiar', { texto }); copiarB.textContent = 'Copiado'; } }, icono('copiar'), 'Copiar instrucciones');
        zona.replaceChildren(h('label', { class: 'campo' }, 'Código de alta'), h('div', { class: 'codigo' }, codigo),
          h('div', { class: 'acciones', style: 'padding:8px 0 0' }, copiarB));
      } catch (e) { err.textContent = e.message; }
    } }, 'Crear código de alta')), zona));
}

// ── Agregar credencial / empresa ─────────────────────────────────────────────
function vistaAgregar() {
  const campos = { nombre: h('input', { placeholder: 'FTP del cliente, VPS de…' }), usuario: h('input', { placeholder: 'Usuario' }),
    clave: h('input', { type: 'password', placeholder: 'Contraseña o API key' }), url: h('input', { placeholder: 'Servidor o URL (ftp.ejemplo.com, 10.0.0.5…)' }),
    alias: h('input', { placeholder: 'Nombre corto para Claude (opcional): club, vps…' }) };
  const err = h('div', { class: 'error' });
  pintar(cabecera('Agregar credencial'), h('div', { class: 'pad', style: 'padding-top:4px;overflow:auto' },
    h('label', { class: 'campo' }, 'Empresa'), casillas('emp', datos.empresas, [datos.empresas[0]], 'radio'),
    h('label', { class: 'campo' }, 'Tipo'), casillas('tipo', [{ valor: 'ssh', texto: 'Servidor (SSH)' }, { valor: 'ftp', texto: 'FTP' }, { valor: 'api', texto: 'API key' }, { valor: '', texto: 'Otra contraseña' }], [''], 'radio'),
    ...Object.entries(campos).flatMap(([k, inp]) => [h('label', { class: 'campo' }, { nombre: 'Nombre', usuario: 'Usuario', clave: 'Contraseña', url: 'Servidor / URL', alias: 'Alias para Claude' }[k]), inp]),
    err,
    h('div', { class: 'acciones', style: 'padding:12px 0 0' }, h('button', { class: 'p', onclick: async () => {
      const [empresa] = marcadas('emp'), [tipo = ''] = marcadas('tipo');
      if (!campos.nombre.value) { err.textContent = 'Ponle un nombre.'; return; }
      try { await pedir('/v1/credenciales', { empresa, tipo, ...Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v.value])) }); await cargar(); }
      catch (e) { err.textContent = e.message; }
    } }, 'Guardar en el vault'))));
}

function vistaEmpresa() {
  const nombre = h('input', { placeholder: 'Nombre de la empresa o cliente' }); const err = h('div', { class: 'error' });
  pintar(cabecera('Nueva empresa'), h('div', { class: 'pad', style: 'padding-top:4px' },
    h('div', { class: 'ayuda' }, 'Se crea como colección en el vault. Luego le agregas credenciales y das acceso.'),
    h('label', { class: 'campo' }, 'Nombre'), nombre, err,
    h('div', { class: 'acciones', style: 'padding:12px 0 0' }, h('button', { class: 'p', onclick: async () => {
      if (!nombre.value.trim()) { err.textContent = 'Escribe un nombre.'; return; }
      try { await pedir('/v1/empresas', { nombre: nombre.value.trim() }); await cargar(); } catch (e) { err.textContent = e.message; }
    } }, 'Crear empresa'))));
}

// ── Arranque ─────────────────────────────────────────────────────────────────
document.getElementById('quien').addEventListener('click', () => token && salir());
(async () => {
  token = await invoke('token_leer');
  token ? cargar() : vistaEntrar();
  setInterval(() => { if (token && document.visibilityState === 'visible' && !vista.querySelector('.x')) cargar(); }, 10_000);
  setInterval(() => { if (token) pedir('/v1/panel').then((d) => { for (const s of d.solicitudes) if (!vistas.has(s.codigo)) { vistas.add(s.codigo); notificar('Claude pide conexión', `${s.equipo} · ${s.codigo}`); } }).catch(() => {}); }, 15_000);
})();
