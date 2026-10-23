<img src="img/icono.png" width="44" align="right" alt="">

# 4 · Uso diario

Abre el panel con el **candado** (arriba a la derecha en Mac; junto al reloj en Windows) o con
**⌘⇧K** / **Ctrl+Shift+K**. Sale en la pantalla donde tengas el mouse. Se esconde solo al hacer clic fuera.

## Buscar y copiar

Escribe en «Buscar» (por nombre, usuario o dirección). **Copiar** pone la clave en el portapapeles y la
**borra a los 30 segundos**. Cada copia queda en el historial.

## Agregar una clave

**Agregar** → empresa, nombre, usuario, clave y dirección. Si quieres que una IA pueda usarla, pon
también **alias** (corto, p. ej. `vps`) y **tipo** (`ssh`, `api` o `ftp`).

## Agregar una empresa o cliente

**Empresa** → nombre. Es una colección nueva en la bóveda; luego puedes aprobar IAs solo para ella.

## Invitar a una persona

**Accesos** → **Invitar persona** → correo y nombre → **Invitar**. A la persona le llega un **correo** con su
código de alta (vale 24 h), la dirección de la Puerta y los pasos. Ella construye la app
([2-app.md](2-app.md)) y hace la «Primera vez». Si el servidor no tiene correo configurado
(`CORREO_WEBHOOK`), la app te muestra el código y un mensaje listo para copiar y mandárselo tú.

**No necesita cuenta de Vaultwarden.** La app entra a la Puerta con su propia cuenta (contraseña + 2FA) y la
Puerta lee la bóveda por ella. Una cuenta de Vaultwarden solo hace falta para usar además las apps de
Bitwarden (celular, extensión del navegador para autocompletar): esa se invita aparte, desde la web de la
bóveda (organización → Miembros → Invitar).

Las personas ven **todas** las empresas. Si alguien solo debe ver algunas, dale acceso en la web de la
bóveda (organización → miembros → colecciones) en vez de una cuenta en la app.

## Aprobar o desconectar una IA

- Cuando una IA pide conexión aparece abajo «Claude pide conexión». Comprueba el código, marca las
  empresas y **Aprobar** (o **Rechazar**).
- **Accesos** muestra las IAs conectadas, desde qué equipo y qué empresas tienen. **Desconectar** la saca
  al instante.

## Si algo falla

| Pasa esto | Haz esto |
|---|---|
| El candado no se ve (Mac con muesca y muchos íconos) | Usa ⌘⇧K |
| «Código incorrecto» al activar | Usa los 6 dígitos de la entrada **CAPE SecretManager** de tu app de códigos, no de otra |
| «Cuenta bloqueada 15 minutos» | 5 intentos fallidos. Espera 15 minutos |
| Olvidé mi contraseña | Otra persona te invita de nuevo (Accesos → Invitar persona) y haces la «Primera vez» |
| Cambié de celular y perdí los códigos | Igual: que te inviten de nuevo |
| La IA dice «No estás conectado» | Que corra `cape conectar` y apruebas el código |
| La IA dice que una empresa no está aprobada | Desconéctala en Accesos y apruébala de nuevo con esa empresa |
| La app no conecta | ¿La dirección en `app/ui/config.js` es la de tu Puerta? `https://puerta…/salud` debe decir `ok` |
