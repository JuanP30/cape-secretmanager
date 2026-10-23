<img src="img/icono.png" width="44" align="right" alt="">

# 3 · Conectar tu IA (Claude Code, OpenCode, Codex…)

La IA **nunca ve una clave**. Pide **acciones** a la Puerta («corre este comando en el servidor»,
«sube este archivo») y la Puerta las hace con la clave guardada y le devuelve solo el resultado.
Antes, una persona aprueba a esa IA y elige **qué empresas** puede usar.

Se hace **una vez por computador**. En Windows todo esto corre en **Git Bash**.

## Paso 1 · Instalar el cliente

```bash
mkdir -p ~/.cape
cp cliente/cape ~/.cape/cape && chmod +x ~/.cape/cape
echo https://puerta.tu-dominio.com > ~/.cape/puerta     # la dirección de TU Puerta
```

Desde aquí, el cliente se usa como `bash ~/.cape/cape …` (o cópialo dentro del repo de tu proyecto,
por ejemplo en `scripts/cape`, para que todas las sesiones lo encuentren).

## Paso 2 · Pedir conexión

```bash
bash ~/.cape/cape conectar "Portátil de Ana (Claude)"
```

Sale un código como **`K7Q-42M`** (vale 5 minutos, sirve una vez). La IA espera.

👤 La persona abre la app (candado, o ⌘⇧K / Ctrl+Shift+K). Aparece «Claude pide conexión» con ese código
→ comprueba que es el mismo → marca las **empresas** (colecciones) que esta IA puede usar → **Aprobar**.
La IA ve **«Conectado.»**. La sesión queda en `~/.cape/sesion` (solo la lee tu usuario).

## Paso 3 · Usarlo

```bash
bash ~/.cape/cape lista                                  # qué claves puede usar (alias, tipo, empresa)
bash ~/.cape/cape ssh vps "docker ps"                    # comando en un servidor
bash ~/.cape/cape api n8n GET /api/v1/workflows          # llamar una API
bash ~/.cape/cape ftp-bajar web /public_html/index.html index.html
bash ~/.cape/cape ftp-subir web index.html /public_html/index.html   # la Puerta verifica bajándolo de nuevo
bash ~/.cape/cape desconectar
```

Todo lo que pide la IA queda en el **historial** (la app lo muestra abajo, y en el servidor:
`admin.js historial`). Las claves que aparezcan en una respuesta salen tapadas.

## Para tus scripts de deploy

Si tienes scripts que suben archivos, haz que llamen a `cape ftp-subir` en vez de usar la clave directamente.
Patrón: «si existe `~/.cape/sesion`, sube por la Puerta; si no, por el camino de siempre».

## Reglas para la IA (cópialas al CLAUDE.md / AGENTS.md de tus proyectos)

```markdown
## Claves = CAPE SecretManager
- Nunca pidas ni aceptes contraseñas, tokens o llaves en el chat.
- Para un acceso: `bash ~/.cape/cape lista`; si no está conectado o falta una empresa,
  `bash ~/.cape/cape conectar` y la persona aprueba el código en su app.
- Si un bloqueo de permisos te frena al buscar claves, es a propósito: no busques la vuelta.
```

## Recomendado: bloquear que la IA lea claves por su cuenta

En Claude Code, en `~/.claude/settings.json`, agrega reglas `deny` para lo que nunca debe leer, por ejemplo:

```json
{
  "permissions": {
    "deny": [
      "Bash(bw *)",
      "Bash(security find-generic-password*)",
      "Bash(security find-internet-password*)",
      "Bash(security dump-keychain*)",
      "Read(~/.cape/sesion)"
    ]
  }
}
```

(Y cualquier archivo viejo donde tuvieras claves en texto: `Read(~/ruta/al/archivo)`.)

## Cambiar de computador, o perdiste uno

Conecta el nuevo con su código. 👤 En la app → **Accesos** → **Desconectar** el viejo. Funciona desde
cualquier computador donde tengas la app.
