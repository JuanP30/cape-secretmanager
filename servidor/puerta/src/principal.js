import * as D from './db.js';
import { crearVault } from './vault.js';
import { ejecutarSsh, llamarApi, ftpBajar, ftpSubir } from './acciones.js';
import { crearServidor } from './servidor.js';
import { crearCorreo } from './correo.js';

const db = D.abrir(process.env.PUERTA_DB || '/datos/puerta.db');
const vault = crearVault();
await vault.sincronizar();
setInterval(() => vault.sincronizar().catch(() => {}), 60_000); // cambios del vault en ≤1 min
crearServidor({ db, vault, acciones: { ejecutarSsh, llamarApi, ftpBajar, ftpSubir }, correoSaliente: crearCorreo() })
  .listen(3000, '0.0.0.0', () => console.log('cape-puerta escuchando en :3000'));
