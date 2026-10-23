#!/usr/bin/env bash
# Backup automático y cifrado de Vaultwarden.
# Destino en el servidor: /docker/vaultwarden/vw-backup.sh  (chmod +x)
# Cron sugerido (diario 3am):  0 3 * * *  /docker/vaultwarden/vw-backup.sh >> /var/log/vw-backup.log 2>&1
set -euo pipefail

DATA="/docker/vaultwarden/data"          # bóveda viva
DEST="/docker/vaultwarden/backups"       # aquí quedan los respaldos cifrados
PASS_FILE="/root/.vw_backup_pass"        # frase de cifrado — DEBE vivir FUERA de la bóveda (ver nota)
KEEP=14                                   # cuántos respaldos diarios conservar
NOTIFY_WEBHOOK=""                         # opcional: URL de un webhook para avisar OK/fallo

TS="$(date +%Y%m%d-%H%M%S)"
STAGE="$(mktemp -d)"
mkdir -p "$DEST"

fail() { [ -n "$NOTIFY_WEBHOOK" ] && curl -s -m10 -X POST "$NOTIFY_WEBHOOK" -H 'Content-Type: application/json' -d "{\"ok\":false,\"ts\":\"$TS\",\"msg\":\"$1\"}" || true; echo "FALLO: $1"; rm -rf "$STAGE"; exit 1; }

[ -f "$PASS_FILE" ] || fail "no existe $PASS_FILE (la frase de cifrado)"

# 1) Copia CONSISTENTE del SQLite (segura aunque Vaultwarden esté corriendo)
sqlite3 "$DATA/db.sqlite3" ".backup '$STAGE/db.sqlite3'" || fail "sqlite .backup falló"

# 2) Copiar el resto de lo necesario para restaurar (adjuntos, config, llaves, sends)
for item in attachments sends config.json rsa_key.pem rsa_key.pub.pem rsa_key.der rsa_key.pub.der; do
  [ -e "$DATA/$item" ] && cp -a "$DATA/$item" "$STAGE/" || true
done

# 3) Empaquetar + cifrar (AES-256, derivación PBKDF2)
tar czf "$STAGE/vw.tar.gz" -C "$STAGE" $(cd "$STAGE" && ls -A | grep -v '^vw.tar.gz$') || fail "tar falló"
openssl enc -aes-256-cbc -pbkdf2 -salt -in "$STAGE/vw.tar.gz" \
  -out "$DEST/vw-$TS.tar.gz.enc" -pass file:"$PASS_FILE" || fail "cifrado falló"

# 4) Rotación: conservar solo los últimos $KEEP
ls -1t "$DEST"/vw-*.tar.gz.enc 2>/dev/null | tail -n +$((KEEP+1)) | xargs -r rm -f

rm -rf "$STAGE"
SIZE="$(du -h "$DEST/vw-$TS.tar.gz.enc" | cut -f1)"
echo "OK backup vw-$TS.tar.gz.enc ($SIZE)"
[ -n "$NOTIFY_WEBHOOK" ] && curl -s -m10 -X POST "$NOTIFY_WEBHOOK" -H 'Content-Type: application/json' -d "{\"ok\":true,\"ts\":\"$TS\",\"size\":\"$SIZE\"}" || true

# NOTA CRÍTICA (chicken-and-egg):
# La frase de $PASS_FILE cifra el respaldo de la bóveda -> NO puede vivir SOLO dentro de la bóveda,
# porque si pierdes el VPS necesitas esa frase para restaurar. Guárdala en 2 sitios independientes:
#   (a) impresa/anotada en un lugar seguro físico, y (b) en el gestor personal del gestor (no en Vaultwarden).
# Además: llevar una copia del .enc FUERA del VPS (descarga manual semanal, o rclone a un storage).
