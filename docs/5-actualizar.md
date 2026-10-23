<img src="img/icono.png" width="44" align="right" alt="">

# 5 · Cómo se hacen las actualizaciones

Hay **un solo código** para Mac y Windows. Lo que cambia es **dónde** vive cada parte, y eso decide
a quién le llega un cambio y cuándo.

| Parte | Dónde vive | Si alguien la cambia… |
|---|---|---|
| **App de la barra** (`app/`) | en cada computador | a nadie le cambia nada hasta que **cada uno** haga `git pull` y la reconstruya |
| **Cliente de la IA** (`cliente/cape`) | en cada computador | igual: cada uno lo copia de nuevo |
| **Puerta y bóveda** (`servidor/`) | **un** servidor, compartido | al desplegarlo, **les cambia a todos al instante** |

No hay actualización automática ni «parche» que se mande: el repo es la única fuente, y cada
computador toma la versión cuando la construye.

## El camino de un cambio

1. **Rama nueva**: `git switch -c mejora-buscar`. Nunca directo a `main`.
2. **Cambio + pruebas**: si toca la Puerta, `cd servidor/puerta && node --test` (todas deben pasar).
   Si toca la app, constrúyela y pruébala **en tu sistema**.
3. **Pull Request** a `main`, explicando qué cambia y por qué. **El otro lo revisa y lo aprueba.**
   Si toca la app, el otro la prueba en **su** sistema (Mac ↔ Windows) antes de aprobar.
4. **Fusionar** a `main`, y luego:
   - Cambió la **app**: cada uno `git pull` + reconstruir ([2-app.md](2-app.md), «Actualizar la app»).
   - Cambió la **Puerta**: la despliega **el administrador del servidor** (abajo). No antes de que el PR esté en `main`.
5. Sube el número de versión en `app/src-tauri/tauri.conf.json` (`"version"`) y anota el cambio en
   [CAMBIOS.md](../CAMBIOS.md).

## Regla de oro: la Puerta nunca rompe a una app vieja

Como cada uno actualiza la app cuando puede, por un tiempo habrá apps de distintas versiones hablando
con la misma Puerta. Por eso, en la Puerta:

- **Agregar** rutas o campos nuevos: sí.
- **Cambiar o quitar** una ruta o un campo que la app ya usa: **no**. Se agrega uno nuevo al lado, se
  actualizan todas las apps, y solo después se quita el viejo, en otro PR.

Ejemplo, «una función nueva de gestor de contraseñas»: si es **solo de pantalla** (por ejemplo, un
generador de contraseñas en el panel), es un cambio de la app. Si necesita **datos nuevos**, primero va
la ruta en la Puerta (se despliega), y luego la app que la usa.

## Desplegar la Puerta (administrador del servidor)

```bash
scp -r servidor/puerta/src servidor/puerta/admin.js servidor/puerta/arranque.sh \
       servidor/puerta/Dockerfile servidor/puerta/package.json root@IP-DEL-SERVIDOR:/docker/puerta/
ssh root@IP-DEL-SERVIDOR "cd /docker/puerta && docker compose up -d --build && docker logs --tail 20 cape-puerta"
curl -s https://puerta.tu-dominio.com/salud     # debe decir ok (tarda ~30 s)
```

(El `.env` y la carpeta `datos/` del servidor **no** se tocan: ahí están las llaves y las sesiones.)
Si algo sale mal: `git checkout <commit-anterior> -- servidor/puerta` y se despliega de nuevo.

## Vaultwarden

Se actualiza cambiando la versión de la imagen en `servidor/vaultwarden/docker-compose.yml`, con el
mismo camino (rama → PR → `main`). **Antes, un respaldo** (`vw-backup.sh`). Lee las notas de la
versión nueva de Vaultwarden por si algo de la marca CAPE deja de verse.

## Cada uno lo acomoda a su gusto

Para un ajuste **solo tuyo** (otro atajo de teclado, otro color), cámbialo en tu copia y no lo subas, o
súbelo en una rama propia. Lo que sirve a los dos va por PR a `main`.
