# 2 · La app de la barra (Mac o Windows)

La app **se construye en tu computador** (unos 10 minutos la primera vez). Tu IA puede hacer casi todo;
tú solo instalas lo que pida permiso de administrador y abres la app al final.

> **Para la IA:** los pasos 👤 los hace la persona. No le pidas contraseñas ni códigos.

## Paso 1 · Bajar el repo

```bash
git clone https://github.com/<dueño>/cape-secretmanager.git
cd cape-secretmanager
```

(El repo es privado: la persona necesita estar invitada como colaboradora en GitHub y haber iniciado
sesión, por ejemplo con `gh auth login`.)

## Paso 2 · Herramientas (una sola vez por computador)

**Mac**
1. 👤 Herramientas de Apple: `xcode-select --install` (abre una ventana: «Instalar»).
2. Rust: `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y`
3. Node 22 o más nuevo: desde https://nodejs.org (o `brew install node`).

**Windows 10/11**
1. 👤 **Visual Studio Build Tools**: https://visualstudio.microsoft.com/visual-cpp-build-tools/ →
   marcar **«Desarrollo para el escritorio con C++»** → Instalar (pesa unos GB, tarda).
2. 👤 **Rust**: https://rustup.rs → bajar `rustup-init.exe` → Enter para la opción por defecto.
3. 👤 **Node 22** o más nuevo: https://nodejs.org (instalador LTS).
4. 👤 **Git para Windows** (trae Git Bash, que usa el cliente de la IA): https://git-scm.com/download/win
5. WebView2 ya viene en Windows 10/11 actualizados. Si la app abre en blanco:
   https://developer.microsoft.com/microsoft-edge/webview2/ → «Evergreen Bootstrapper».

Cierra y vuelve a abrir la terminal después de instalar, para que encuentre `cargo` y `node`.

## Paso 3 · Decirle a la app dónde está tu Puerta

Reemplaza `https://puerta.TU-DOMINIO.com` por la dirección de tu Puerta en **dos** archivos:
- `app/ui/config.js`
- `app/src-tauri/tauri.conf.json` (en la línea `connect-src`)

Si la Puerta la montó otra persona (por ejemplo tu socio), pídele la dirección: no es secreta.

## Paso 4 · Construir

```bash
cd app
npx -y @tauri-apps/cli@2.12.1 build
```

Al terminar dice dónde quedó el instalador:

| Sistema | Archivo | Cómo instalar |
|---|---|---|
| Mac | `src-tauri/target/release/bundle/dmg/CAPE SecretManager_*.dmg` | 👤 Abrir el `.dmg` y arrastrar la app a **Aplicaciones** |
| Windows | `src-tauri\target\release\bundle\nsis\CAPE SecretManager_*-setup.exe` | 👤 Doble clic → Siguiente → Instalar |

**Avisos de seguridad la primera vez** (la app no está firmada; es normal en una app propia):
- Mac: «no se puede abrir porque es de un desarrollador no identificado» → 👤 clic derecho sobre la app
  → **Abrir** → **Abrir**. Solo la primera vez.
- Windows: «Windows protegió tu PC» → 👤 **Más información** → **Ejecutar de todas formas**.

Para que arranque sola al encender: Mac → Configuración del Sistema → General → Ítems de inicio → `+`.
Windows → `Win + R` → `shell:startup` → pon ahí un acceso directo a la app.

## Paso 5 · Primera vez 👤

La app no abre ventana: aparece un **candado** arriba a la derecha (Mac) o junto al reloj (Windows;
puede estar en la flechita `^`). También se abre con **⌘⇧K** (Mac) o **Ctrl+Shift+K** (Windows).

1. Toca **«Primera vez · tengo un código de alta»**.
2. Escribe tu correo, el **código de alta** que te dio el administrador y una contraseña nueva (mínimo 10 caracteres).
3. Aparece un **QR**: escanéalo con tu app de códigos (Google Authenticator, Microsoft Authenticator,
   1Password…). Escribe los **6 dígitos** que muestra **la entrada nueva «CAPE SecretManager»**
   (no la de Vaultwarden ni otra) → **Activar**.
4. **Entrar** con correo, contraseña y los 6 dígitos del momento. La sesión queda guardada en el
   Llavero (Mac) o el Administrador de credenciales (Windows); no tendrás que entrar cada vez.

## Actualizar la app

```bash
git pull
cd app && npx -y @tauri-apps/cli@2.12.1 build
```

y vuelve a instalar como en el paso 4 (la sesión se conserva).
