# Cambios

Lo más nuevo arriba. Al cambiar algo: sube `"version"` en `app/src-tauri/tauri.conf.json` y anota aquí
qué cambió, en qué parte (**app**, **Puerta**, **cliente**, **bóveda**) y si hay que reconstruir o desplegar.

## Pendientes (actualizaciones oficiales aprobadas, por hacer)
- _(ninguna todavía — cada una enlaza su Issue con la etiqueta `pendiente`)_

## 0.2.1 — 25-oct-2026 · Windows probado de verdad
- **App** (solo cambia en Windows; en Mac hay que reconstruir y probar que todo sigue igual):
  - El candado de la bandeja era negro (plantilla de Mac) y no se veía en la barra oscura: en Windows
    va el ícono morado de la app.
  - Clic en el ícono con el panel abierto lo cerraba y lo volvía a abrir al instante (perder el foco lo
    ocultaba y el clic lo reabría). Ahora lo cierra.
  - Con Ctrl+Shift+K el panel salía arriba, como en el Mac; ahora sale junto a la barra de tareas,
    esté donde esté. Desde el ícono junto al reloj se salía por la derecha: ahora queda dentro.
  - Sin Mica (Windows 10) el panel quedaba transparente: ahora tiene fondo sólido. Esquinas de 8 px,
    como las que pone Windows.
- **Cliente**: `cliente/cape.ps1` para usarlo desde PowerShell con el Git Bash (no el de WSL).
  `~/.cape/puerta` escrito desde PowerShell (UTF-16, BOM o CRLF) ya no rompe la dirección.
  Skill para Claude Code en `cliente/skill-claude/`. Copiar de nuevo a `~/.cape/`.
- **Repo**: `.gitattributes` mantiene en LF lo que corre en bash o en el servidor. Antes, un clon en
  Windows dejaba `cliente/cape` y `arranque.sh` con CRLF (bash de WSL/Linux falla con eso).

## 0.2.0 — 23-oct-2026
- **Puerta**: «Invitar persona» envía un correo con el código de alta, la dirección de la Puerta y los pasos
  (`CORREO_WEBHOOK`, opcional). **Hay que desplegar la Puerta.**
- **App**: la pantalla de invitar dice si el correo salió. **Hay que reconstruir la app.**

## 0.1.0 — 23-oct-2026
- Primera versión: bóveda (Vaultwarden 1.37.4) + Puerta + app de la barra (Mac y Windows) + cliente para IA.
