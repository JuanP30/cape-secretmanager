#!/bin/sh
# Desbloquea el vault con el usuario de servicio y levanta bw serve (solo 127.0.0.1) + la Puerta.
set -eu
# `bw config server` solo sin sesión guardada: con una sesión en /datos falla («Logout required»)
# y el contenedor entra en bucle de reinicios (visto el 22-oct al redesplegar).
if ! bw login --check >/dev/null 2>&1; then
  bw config server "$VW_URL" >/dev/null
  BW_CLIENTID=$PUERTA_CLIENT_ID BW_CLIENTSECRET=$PUERTA_CLIENT_SECRET bw login --apikey >/dev/null
fi
BW_SESSION=$(bw unlock --passwordenv PUERTA_MASTER --raw)
export BW_SESSION
unset PUERTA_CLIENT_SECRET PUERTA_MASTER
bw serve --hostname 127.0.0.1 --port 8087 &
node -e 'const t=Date.now();(async function e(){try{await fetch("http://127.0.0.1:8087/status");}catch{if(Date.now()-t>60000)process.exit(1);setTimeout(e,500);}})()'
exec node src/principal.js
