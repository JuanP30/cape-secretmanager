// CLI de mantenimiento en el VPS (docker exec cape-puerta node admin.js …). Aprobar, rechazar y
// desconectar YA NO están aquí: solo una persona con clave + 2FA (la app de la barra).
//   alta <correo> <nombre>   → código de alta (24 h) para que esa persona ponga su clave y su 2FA
import * as D from './src/db.js';
import * as P from './src/personas.js';
import { crearVault, campo } from './src/vault.js';

const db = D.abrir(process.env.PUERTA_DB || '/datos/puerta.db');
const [cmd, ...a] = process.argv.slice(2);

switch (cmd) {
  case 'alta': {
    if (!a[0] || !a[1]) { console.log('Uso: alta <correo> <nombre>'); process.exit(1); }
    const codigo = P.crearAlta(db, a[0], a.slice(1).join(' '), Date.now());
    D.registrar(db, 0, 'alta', a[0], true, 'admin.js');
    console.log(`Código de alta para ${a[0]} (vale 24 h): ${codigo}\nEn su app: «Primera vez · tengo un código de alta».`);
    break;
  }
  case 'personas':
    for (const p of P.listarPersonas(db)) console.log(`${p.correo}  ${p.nombre}  ${p.activa ? 'activa' : 'pendiente de alta'}`);
    break;
  case 'sesiones':
    for (const s of D.listarSesiones(db))
      console.log(`${s.id}  ${s.tipo}  ${s.equipo}  ${JSON.parse(s.empresas).join(',')}  ${s.revocada ? 'DESCONECTADA' : 'activa'}`);
    break;
  case 'historial':
    for (const h of D.listarHistorial(db, Number(a[0] || 20)))
      console.log(`${h.fecha}  sesión ${h.sesion_id}  ${h.accion} ${h.destino}  ${h.ok ? 'ok' : 'FALLÓ'}  ${h.detalle}`);
    break;
  case 'marcar': {
    const [nombre, alias, tipo, ...extra] = a;
    if (!nombre || !alias || !['ssh', 'api', 'ftp'].includes(tipo)) { console.log('Uso: marcar "<item>" <alias> <ssh|api|ftp> [clave=valor …]'); process.exit(1); }
    const vault = crearVault();
    const items = (await vault.items()).filter((i) => i.name === nombre);
    if (items.length !== 1) { console.log(`${items.length} items se llaman «${nombre}» (debe haber 1)`); process.exit(1); }
    const item = items[0];
    const poner = (k, v) => { item.fields = (item.fields || []).filter((f) => f.name !== k); item.fields.push({ name: k, value: v, type: 0 }); };
    poner('cape_alias', alias); poner('cape_tipo', tipo);
    for (const kv of extra) { const [k, ...v] = kv.split('='); poner(`cape_${k}`, v.join('=')); }
    await vault.guardarItem(item);
    console.log(`marcada: «${nombre}» → ${alias} (${tipo})${campo(item, 'cape_host') ? ' host ' + campo(item, 'cape_host') : ''}`);
    break;
  }
  default:
    console.log('Comandos: alta <correo> <nombre> | personas | sesiones | historial [n] | marcar "<item>" <alias> <ssh|api|ftp> [clave=valor]');
}
