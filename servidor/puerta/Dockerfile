FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends sshpass openssh-client ca-certificates curl \
 && rm -rf /var/lib/apt/lists/* && npm install -g @bitwarden/cli@2026.9.1 && npm cache clean --force
WORKDIR /app
COPY package.json admin.js arranque.sh ./
COPY src ./src
ENV BITWARDENCLI_APPDATA_DIR=/datos/bw NODE_NO_WARNINGS=1 PUERTA_DB=/datos/puerta.db
CMD ["sh", "/app/arranque.sh"]
