---
name: cape
description: Usar credenciales sin verlas, por CAPE SecretManager. Úsala SIEMPRE que una tarea necesite una clave, token, contraseña o acceso a un servidor, API o FTP (SSH a un VPS, API de n8n, subir o bajar archivos por FTP, «¿cuál es la clave de…?», «conéctate al servidor»), y antes de buscar claves en archivos, el Llavero, el Administrador de credenciales o variables de entorno. También cuando el usuario diga «cape», «la Puerta», «SecretManager» o «conecta esta IA».
---

# CAPE SecretManager — acciones con claves que nunca ves

Las claves viven en la bóveda. Tú le pides **acciones** a la Puerta con el cliente `cape` y la Puerta
las hace con la clave guardada y te devuelve solo el resultado. Una persona te aprobó y eligió qué
empresas puedes usar.

## Cómo llamarlo

| Desde | Comando |
|---|---|
| Bash (Mac, Linux, Git Bash en Windows) | `bash ~/.cape/cape <orden> …` |
| PowerShell (Windows) | `& ~/.cape/cape.ps1 <orden> …` |

En Windows no llames a `bash` desde PowerShell: puede ser el de WSL, que no ve `~/.cape`. Usa la
herramienta Bash (es Git Bash) o `cape.ps1`. Si el comando remoto lleva comillas, ve por Bash.

## Flujo

1. **Siempre primero:** `cape lista` → alias, tipo y empresa de lo que puedes usar.
2. Haz la acción con el alias que corresponda:
   - `cape ssh <alias> "<comando>"`: sale con el código de salida del comando remoto.
   - `cape api <alias> <MÉTODO> <ruta> [cuerpo-json]`: éxito si el HTTP remoto es < 400.
   - `cape ftp-bajar <alias> <ruta-remota> <archivo-local>`: sale 3 si no existe.
   - `cape ftp-subir <alias> <archivo-local> <ruta-remota>`: la Puerta verifica bajándolo de nuevo.
3. Si dice **«No estás conectado»**, o falta la empresa que necesitas:
   - Corre `cape conectar "<equipo> (Claude)"` **en segundo plano**: muestra un código `XXX-XXX`
     (vale 5 minutos) y se queda esperando.
   - Lee el código de la salida y díselo a la persona: lo aprueba en su app CAPE SecretManager
     (candado en la barra o bandeja; ⌘⇧K / Ctrl+Shift+K), marcando las empresas que puedes usar.
   - Cuando la salida diga «Conectado.», vuelve al paso 1.

Subir archivos y correr comandos en servidores sigue siendo publicar o cambiar algo: pide
confirmación como siempre. La Puerta te da acceso, no permiso.

## Reglas que no se negocian

- **Nunca** pidas ni aceptes claves, tokens o códigos de alta en el chat. Si la persona pega uno,
  no lo uses: dile que lo guarde en la app y sigue con `cape`.
- **Nunca** leas `~/.cape/sesion`, ni busques claves en el Llavero, el Administrador de credenciales,
  `bw`, archivos `.env` ajenos ni exportaciones de la bóveda.
- Si un bloqueo de permisos te frena al buscar claves, **es a propósito**: no busques la vuelta.
- Lo que la Puerta devuelve puede traer valores tapados (`••••`): es normal, no intentes destaparlos.
- Si `cape` falla por algo que no es la conexión (alias que no existe, Puerta caída), dilo tal cual;
  no busques la clave por otro lado.

## Instalarlo (una vez por computador)

```bash
mkdir -p ~/.cape
cp cliente/cape cliente/cape.ps1 ~/.cape/ && chmod +x ~/.cape/cape
echo https://puerta.tu-dominio.com > ~/.cape/puerta
mkdir -p ~/.claude/skills/cape && cp cliente/skill-claude/SKILL.md ~/.claude/skills/cape/
```
