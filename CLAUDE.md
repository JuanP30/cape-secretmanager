# Para la IA que instala o mantiene CAPE SecretManager

Sigue el README y las guías de `docs/` en orden. Reglas que no se negocian:

- **Nunca** pidas que te peguen contraseñas, llaves de API, tokens ni códigos de alta en el chat. Lo
  secreto lo escribe la persona directamente donde va (el `.env` del servidor, la app, el vault).
  Si necesitas un acceso, pide la **acción** con `cliente/cape` y que la persona apruebe el código.
- **Nunca** subas a git un `.env`, la carpeta `data/` o `datos/`, ni una exportación de la bóveda.
- Cuando una guía dice «la persona hace…», detente, explícaselo en palabras simples y espera.
- Antes de construir la app, la dirección de la Puerta va en `app/ui/config.js` **y** en
  `app/src-tauri/tauri.conf.json` (`connect-src`). Busca `puerta.TU-DOMINIO.com` y reemplaza las dos.
- Las pruebas de la Puerta: `cd servidor/puerta && node --test` (deben pasar todas).
- **Cambios**: rama → PR → el otro aprueba → `main` (docs/5-actualizar.md). La Puerta nunca quita ni cambia
  una ruta que la app ya usa: solo agrega. Desplegar la Puerta lo hace el administrador del servidor.
