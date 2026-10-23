# CAPE SecretManager

Un lugar para guardar las claves de tu empresa (y de tus clientes) en **tu propio servidor**, verlas
desde un candado en la barra del computador, y dejar que tu IA (Claude, OpenCode…) **haga cosas con
ellas sin verlas nunca**.

```
   Tú / tu equipo                         Tu servidor (Docker)                     Tu IA
 ┌──────────────────┐  clave + 2FA   ┌───────────────────────────────┐   código   ┌────────────────┐
 │ App de la barra  │ ─────────────▶ │ Puerta  ──▶  Vaultwarden      │ ◀───────── │ cliente «cape» │
 │ (Mac / Windows)  │  ver, copiar,  │ (API)        (la bóveda)      │  pide      │ ssh / api / ftp│
 │                  │  aprobar IAs   │   └─ usa la clave y devuelve  │  ACCIONES  │ nunca ve claves│
 └──────────────────┘                │      solo el resultado        │            └────────────────┘
                                     └───────────────────────────────┘
```

- **Vaultwarden**: la bóveda (código abierto, compatible con las apps de Bitwarden). Vive en tu servidor.
- **Puerta**: una API pequeña junto a la bóveda. Las personas entran con contraseña + código de 6 dígitos;
  las IAs se conectan con un código que una persona aprueba, y solo pueden pedir **acciones**
  (correr un comando por SSH, llamar una API, subir un archivo por FTP). La clave nunca sale del servidor.
- **App de la barra**: ícono de candado arriba (Mac) o junto al reloj (Windows). Buscar, copiar
  (se borra del portapapeles a los 30 s), agregar claves y empresas, invitar personas, aprobar y desconectar IAs.
- **Cliente `cape`**: un script que tu IA usa para pedir acciones.

Nada pasa por una nube ajena: todo es tu servidor y tus computadores.

## Cómo se instala (en este orden)

| Paso | Quién | Guía |
|---|---|---|
| 1. Servidor: bóveda + Puerta | quien administra el servidor, una vez | [docs/1-servidor.md](docs/1-servidor.md) |
| 2. App de la barra (Mac o Windows) | cada persona, en su computador | [docs/2-app.md](docs/2-app.md) |
| 3. Conectar tu IA | cada persona, una vez por computador | [docs/3-ia.md](docs/3-ia.md) |
| 4. Uso diario | todos | [docs/4-uso.md](docs/4-uso.md) |

**La app no se descarga hecha: se construye.** Abre este repo con tu IA y dile:
«Instala CAPE SecretManager siguiendo el README». La IA sigue las guías y te pide solo lo que tienes
que hacer tú (escanear un QR, aprobar un código, escribir tu contraseña).

## Carpetas

- `servidor/vaultwarden/` — Docker de la bóveda, marca CAPE (estilos y correos) y respaldo cifrado.
- `servidor/puerta/` — la Puerta (Node 22, sin dependencias) y sus pruebas (`node --test`).
- `app/` — la app de la barra (Tauri 2: Rust + HTML).
- `cliente/cape` — el cliente para la IA (bash; en Windows corre en Git Bash).
