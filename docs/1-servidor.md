<img src="img/icono.png" width="44" align="right" alt="">

# 1 · El servidor: bóveda + Puerta

Se hace **una vez por empresa**. Al final tendrás dos direcciones:
`https://vault.tu-dominio.com` (la bóveda) y `https://puerta.tu-dominio.com` (la Puerta).

> **Para la IA:** los pasos marcados 👤 los hace la persona. Explícale qué hacer y espera.
> Nunca le pidas que te pegue contraseñas o llaves: las escribe ella en el servidor o en la web.

## Qué necesitas

- Un servidor Linux (un VPS de Hostinger, DigitalOcean, etc.) con **Docker** y **Docker Compose**.
- **Traefik** corriendo en ese servidor con certificados de Let's Encrypt. Anota tres datos de tu Traefik:
  el nombre de su **red** de Docker, sus **entrypoints** (casi siempre `web,websecure`) y el nombre del
  **certresolver**. Si no tienes Traefik, pídele a tu IA: «levanta Traefik con Let's Encrypt en Docker».
- Un dominio donde puedas crear registros DNS.

## Paso 1 · DNS 👤

En el panel de tu dominio crea dos registros **A** que apunten a la IP del servidor:
`vault` y `puerta`. Comprueba con `dig +short vault.tu-dominio.com` (debe dar la IP).

## Paso 2 · Copiar los archivos al servidor

```bash
scp -r servidor/vaultwarden servidor/puerta root@IP-DEL-SERVIDOR:/docker/
```

Quedan en `/docker/vaultwarden` y `/docker/puerta`.

## Paso 3 · La bóveda (Vaultwarden)

1. En el servidor: `cd /docker/vaultwarden && cp .env.ejemplo .env`.
2. Rellena `VAULT_DOMINIO`, `TRAEFIK_RED`, `TRAEFIK_CERTRESOLVER`.
3. 👤 **Contraseña del panel de administración.** La persona la inventa y la convierte en hash:
   ```bash
   docker run --rm -it vaultwarden/server:1.37.4 /vaultwarden hash --preset owasp
   ```
   Escribe la contraseña dos veces. Copia el resultado (empieza por `$argon2id$`) en `.env` **entre
   comillas simples**: `VW_ADMIN_TOKEN='$argon2id$...'` (sin comillas, Docker se come los `$`).
4. 👤 **Correo** (para invitaciones y avisos). Lo más fácil: una cuenta de Gmail con una
   [contraseña de aplicación](https://myaccount.google.com/apppasswords). Rellena `SMTP_USERNAME`,
   `SMTP_PASSWORD`, `SMTP_FROM` (la misma cuenta). Si prefieres n8n, mira la «opción B» en `docker-compose.yml`.
5. **Marca CAPE** en las páginas y los correos:
   ```bash
   mkdir -p data/templates/scss data/templates/email
   cp branding/user.vaultwarden.scss.hbs data/templates/scss/
   cp branding/email/* data/templates/email/
   sed -i 's/vault.TU-DOMINIO.com/vault.tu-dominio.com/' data/templates/email/email_header.hbs
   ```
6. Arranca: `docker compose up -d`. Espera ~30 s (Traefik da 404 hasta que el contenedor está sano)
   y abre `https://vault.tu-dominio.com`.

## Paso 4 · Tu cuenta, la organización y las empresas 👤

1. Entra a `https://vault.tu-dominio.com/admin` con la contraseña del paso 3 → **Users → Invite user**
   → tu correo. Te llega la invitación: crea tu cuenta con una **contraseña maestra** (no se puede
   recuperar: anótala en un lugar seguro) y activa el **inicio de sesión en dos pasos**.
2. En la bóveda: **Nueva organización** (p. ej. «Mi empresa»).
3. Dentro de la organización crea **una colección por empresa o cliente** (p. ej. «Club», «VPS»,
   «Cliente X»). Las IAs se aprueban **por colección**: una IA aprobada para «Club» solo ve «Club».
4. Mete tus claves en esas colecciones (o impórtalas: Herramientas → Importar datos).

## Paso 5 · El usuario de servicio de la Puerta 👤

La Puerta entra a la bóveda con su propia cuenta, como un empleado más.

1. En `/admin` invita un correo para ella. Truco de Gmail: `tucorreo+puerta@gmail.com` llega a tu mismo buzón.
2. Acepta la invitación y crea la cuenta con una contraseña larga (guárdala en tu bóveda personal).
3. En tu organización: **Miembros → invitar** ese correo con rol **Administrador** y acceso a todas las
   colecciones. Cuando acepte, pulsa **Confirmar** (sin esto la Puerta ve 0 claves).
4. Entra a la bóveda **con la cuenta de la Puerta** → Configuración → Seguridad → **Llaves** →
   **Ver clave de API**. Usa la del **usuario** (`client_id` empieza por `user.`), no la de la organización.

## Paso 6 · La Puerta

1. En el servidor: `cd /docker/puerta && cp .env.ejemplo .env`.
2. Rellena `PUERTA_DOMINIO`, `VW_URL` (`https://vault.tu-dominio.com`), `TRAEFIK_RED`, `TRAEFIK_CERTRESOLVER`.
3. 👤 La persona escribe en ese `.env`, directamente en el servidor: `PUERTA_CLIENT_ID`,
   `PUERTA_CLIENT_SECRET` (las llaves del paso 5.4) y `PUERTA_MASTER` (la contraseña de la cuenta de la Puerta).
   Luego `chmod 600 .env`.
4. Arranca: `docker compose up -d --build`. Comprueba: `curl https://puerta.tu-dominio.com/salud` → `ok`.

## Paso 7 · La primera persona (tú)

```bash
docker exec cape-puerta node admin.js alta tucorreo@ejemplo.com "Tu nombre"
```

Sale un **código de alta** (vale 24 h). 👤 La persona lo usa en la app: «Primera vez · tengo un código
de alta» (ver [2-app.md](2-app.md)). Si lo ve la IA, que no lo use: lo usa solo la persona.
A las demás personas se las invita **desde la app** (Accesos → Invitar persona).

## Paso 8 · Claves que la IA puede usar

Una clave solo sirve para acciones si tiene **alias** y **tipo**. Lo más fácil: al crearla con
**Agregar** en la app, rellena alias (p. ej. `vps`) y tipo (`ssh`, `api` o `ftp`). Para una clave que ya
existe:

```bash
docker exec cape-puerta node admin.js marcar "Nombre exacto de la clave" vps ssh
docker exec cape-puerta node admin.js marcar "FTP de mi web" web ftp raiz=/public_html/
docker exec cape-puerta node admin.js marcar "API de n8n" n8n api base=https://n8n.tu-dominio.com cabecera=X-N8N-API-KEY prefijo=
```

Campos opcionales: `host=` y `puerto=` (ssh/ftp; si no, se usa la URL de la clave), `raiz=` (ftp: la IA
solo puede subir dentro de esa carpeta), `base=`, `cabecera=`, `prefijo=` (api).

## Paso 9 · Respaldos (no lo saltes)

`servidor/vaultwarden/vw-backup.sh` hace una copia **cifrada** de la bóveda cada noche. Instrucciones
dentro del archivo: crear la frase de cifrado en `/root/.vw_backup_pass` (👤 la persona la anota también
fuera del servidor) y agregar la línea de cron. **Prueba a restaurar una vez.**

## Comandos útiles (en el servidor)

```bash
docker exec cape-puerta node admin.js personas      # quién tiene cuenta
docker exec cape-puerta node admin.js sesiones      # personas e IAs conectadas
docker exec cape-puerta node admin.js historial 50  # últimas acciones
docker logs --tail 50 cape-puerta
```
