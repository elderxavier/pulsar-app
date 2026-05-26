#!/bin/bash
#
# Publica o site Pulsar (pulsar.appsx.com.br) no servidor appsx.
#
# Arquitetura:
#   - pulsar-1: SPA Angular na rede appsx-network
#   - appsx-site: nginx edge com SSL, proxy pulsar.appsx.com.br -> pulsar-1
#
# Pré-requisitos no servidor:
#   - docker, docker-compose, rede appsx-network
#   - container appsx-site (edge nginx)
#   - certificado em /etc/letsencrypt/live/pulsar.appsx.com.br/

set -o errexit
set -o nounset
set -o pipefail

SERVER="${PULSAR_SERVER:-166.1.227.223}"
USER="${PULSAR_USER:-root}"
PASSWORD="${PULSAR_SSH_PASSWORD:-b+Lk412mZZrXGB}"
DOMAIN="pulsar.appsx.com.br"
CERT_DIR="/etc/letsencrypt/live/$DOMAIN"

REMOTE_HOME="/home"
REMOTE_DOCKER_DIR="$REMOTE_HOME/docker/pulsar"
REMOTE_NGINX_DIR="$REMOTE_HOME/docker/nginx"
DOCKER_COMPOSE_FILE="docker-compose-pulsar.yaml"
APPSX_COMPOSE_FILE="docker-compose-app.yaml"

LOCAL_BASE_DIR="/shared/pulsar-app"
LOCAL_SITE_DIR="$LOCAL_BASE_DIR/pulsar-site"
LOCAL_SITE_DIST="$LOCAL_SITE_DIR/dist/pulsar-site/browser"
LOCAL_DOCKERFILE="$LOCAL_SITE_DIR/docker/pulsar-dockerfile"
LOCAL_NGINX_DIR="$LOCAL_SITE_DIR/docker/nginx"
LOCAL_APK_PATH="$LOCAL_BASE_DIR/mobile/app/build/outputs/apk/debug/app-debug.apk"
APPSX_PUBLIC_NGINX_CONF="/shared/appsx/site/docker/nginx/default.conf"

SITE_STAGING_DIR="$(mktemp -d /tmp/pulsar-site-publish.XXXXXX)"
cleanup() { rm -rf "$SITE_STAGING_DIR"; }
trap cleanup EXIT

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if ! command -v sshpass >/dev/null 2>&1; then
    echo -e "${RED}Erro: sshpass não está instalado. sudo apt install sshpass${NC}"
    exit 1
fi

SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o LogLevel=ERROR)
RSYNC_SSH="ssh ${SSH_OPTS[*]}"

echo -e "${GREEN}=== PUBLICANDO PULSAR ($DOMAIN) ===${NC}"

echo -e "${GREEN}[1/6] Compilando pulsar-site...${NC}"
cd "$LOCAL_SITE_DIR"
npm run build

if [ ! -d "$LOCAL_SITE_DIST" ]; then
    echo -e "${RED}Erro: build não gerou $LOCAL_SITE_DIST${NC}"
    exit 1
fi

echo -e "${GREEN}[2/6] Preparando artefatos (site + APK)...${NC}"
rsync -a --delete "$LOCAL_SITE_DIST"/ "$SITE_STAGING_DIR"/

if [ -f "$LOCAL_APK_PATH" ]; then
    mkdir -p "$SITE_STAGING_DIR/downloads"
    cp "$LOCAL_APK_PATH" "$SITE_STAGING_DIR/downloads/pulsar.apk"
    echo -e "${GREEN}APK incluído em downloads/pulsar.apk${NC}"
else
    echo -e "${YELLOW}Aviso: APK não encontrado. Deploy seguirá sem APK.${NC}"
fi

echo -e "${GREEN}[3/6] Criando estrutura remota...${NC}"
sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" "
    mkdir -p $REMOTE_DOCKER_DIR/docker/site/wwww
    mkdir -p $REMOTE_DOCKER_DIR/docker/nginx
    mkdir -p $REMOTE_NGINX_DIR /var/www/certbot
    docker network create appsx-network 2>/dev/null || true
"

echo -e "${GREEN}[4/6] Copiando artefatos pulsar...${NC}"
sshpass -p "$PASSWORD" rsync -avz --delete \
    -e "$RSYNC_SSH" \
    "$SITE_STAGING_DIR"/ \
    "$USER@$SERVER:$REMOTE_DOCKER_DIR/docker/site/wwww/"

sshpass -p "$PASSWORD" rsync -avz \
    -e "$RSYNC_SSH" \
    "$LOCAL_DOCKERFILE" \
    "$USER@$SERVER:$REMOTE_DOCKER_DIR/docker/pulsar-dockerfile"

sshpass -p "$PASSWORD" rsync -avz --delete \
    -e "$RSYNC_SSH" \
    "$LOCAL_NGINX_DIR"/ \
    "$USER@$SERVER:$REMOTE_DOCKER_DIR/docker/nginx/"

cat > "$SITE_STAGING_DIR/$DOCKER_COMPOSE_FILE" <<'YAML'
services:
  pulsar:
    build:
      context: ./
      dockerfile: ./docker/pulsar-dockerfile
    container_name: pulsar-1
    restart: unless-stopped
    networks:
      - appsx-network
    environment:
      - TZ=America/Sao_Paulo
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  appsx-network:
    external: true
YAML

sshpass -p "$PASSWORD" rsync -avz \
    -e "$RSYNC_SSH" \
    "$SITE_STAGING_DIR/$DOCKER_COMPOSE_FILE" \
    "$USER@$SERVER:$REMOTE_DOCKER_DIR/$DOCKER_COMPOSE_FILE"

echo -e "${GREEN}[5/6] Nginx edge (appsx-site) + certificado SSL...${NC}"
if [ ! -f "$APPSX_PUBLIC_NGINX_CONF" ]; then
    echo -e "${RED}Erro: $APPSX_PUBLIC_NGINX_CONF não encontrado${NC}"
    exit 1
fi
if ! grep -q "pulsar.appsx.com.br" "$APPSX_PUBLIC_NGINX_CONF"; then
    echo -e "${RED}Erro: nginx appsx sem bloco pulsar.appsx.com.br${NC}"
    exit 1
fi

sshpass -p "$PASSWORD" rsync -avz \
    -e "$RSYNC_SSH" \
    "$APPSX_PUBLIC_NGINX_CONF" \
    "$USER@$SERVER:$REMOTE_NGINX_DIR/default.conf"

CERT_OK=$(sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" \
    "test -f $CERT_DIR/fullchain.pem && echo 1 || echo 0")
if [ "${CERT_OK:-0}" = "0" ]; then
    echo -e "${YELLOW}Emitindo certificado para $DOMAIN...${NC}"
    sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" "
        set -e
        docker stop appsx-site 2>/dev/null || true
        apt-get install -y certbot 2>/dev/null || true
        certbot certonly --standalone --non-interactive --agree-tos \
            --register-unsafely-without-email -d $DOMAIN
        docker start appsx-site 2>/dev/null || true
    "
fi

echo -e "${GREEN}[6/6] Build pulsar-1 + rebuild appsx-site...${NC}"
sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" "
    set -e
    cd $REMOTE_DOCKER_DIR
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f $DOCKER_COMPOSE_FILE up -d --build pulsar
    else
        docker compose -f $DOCKER_COMPOSE_FILE up -d --build pulsar
    fi

    cd $REMOTE_HOME
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose -f $APPSX_COMPOSE_FILE up -d --build app
    else
        docker compose -f $APPSX_COMPOSE_FILE up -d --build app
    fi

    docker exec appsx-site nginx -t
"

echo -e "${GREEN}✓ Pulsar publicado em https://$DOMAIN${NC}"
sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" \
    "docker ps --filter name=pulsar-1 --filter name=appsx-site"
