#!/bin/bash
#
# Publica o site Pulsar (pulsar.e-mec.net.br) no servidor 212.192.3.5.
#
# Arquitetura:
#   - O container pulsar-1 serve o SPA Angular internamente em :80
#   - O nginx público (home-app-1) faz proxy reverso e termina SSL
#   - SSL: cert compartilhado /etc/letsencrypt/live/e-mec.net.br/ (precisa
#     incluir pulsar.e-mec.net.br via `certbot --expand` antes do primeiro deploy)
#
# Pré-requisitos no servidor:
#   - docker, docker-compose, network `e-mec-network` existente
#   - container home-app-1 (e-mec) já em execução com nginx público
#   - DNS pulsar.e-mec.net.br -> 212.192.3.5
#   - Certificado Let's Encrypt cobrindo pulsar.e-mec.net.br

set -o errexit
set -o nounset
set -o pipefail

SERVER="212.192.3.5"
USER="root"
PASSWORD="w-G^Q9Q+9eqjh-"

REMOTE_BASE_DIR="/home"
REMOTE_DOCKER_DIR="$REMOTE_BASE_DIR/docker/pulsar"
REMOTE_SITE_DIR="$REMOTE_DOCKER_DIR/wwww"
DOCKER_COMPOSE_FILE="docker-compose-pulsar.yaml"

LOCAL_BASE_DIR="/shared/pulsar-app"
LOCAL_SITE_DIR="$LOCAL_BASE_DIR/pulsar-site"
LOCAL_SITE_DIST="$LOCAL_SITE_DIR/dist/pulsar-site/browser"
LOCAL_DOCKERFILE="$LOCAL_SITE_DIR/docker/pulsar-dockerfile"
LOCAL_NGINX_DIR="$LOCAL_SITE_DIR/docker/nginx"
LOCAL_COMPOSE_FILE="$LOCAL_BASE_DIR/$DOCKER_COMPOSE_FILE"
LOCAL_APK_PATH="$LOCAL_BASE_DIR/mobile/app/build/outputs/apk/debug/app-debug.apk"

# Nginx público do e-mec (precisa rotear pulsar.e-mec.net.br -> pulsar-1)
EMEC_PUBLIC_NGINX_CONF="/shared/e-mec/e-mec-online/docker/nginx/default.conf"
EMEC_REMOTE_NGINX_CONF="$REMOTE_BASE_DIR/docker/nginx/default.conf"
EMEC_COMPOSE_FILE="docker-compose-app.yaml"

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

echo -e "${GREEN}=== PUBLICANDO PULSAR SITE (pulsar.e-mec.net.br) ===${NC}"

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
    echo -e "${YELLOW}Aviso: APK não encontrado em $LOCAL_APK_PATH. Deploy seguirá sem APK.${NC}"
fi

echo -e "${GREEN}[3/6] Criando estrutura remota...${NC}"
sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" "
    mkdir -p $REMOTE_DOCKER_DIR/docker/site/wwww
    mkdir -p $REMOTE_DOCKER_DIR/docker/nginx
    docker network create e-mec-network 2>/dev/null || true
"

echo -e "${GREEN}[4/6] Copiando artefatos pulsar para o servidor...${NC}"
# Estrutura no servidor: $REMOTE_DOCKER_DIR contém o build context do dockerfile.
# O dockerfile referencia ./docker/nginx/default.conf e ./docker/site/wwww
# portanto criamos a árvore espelhada.
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

# Compose ajustado para apontar build context para ./ (sem o subdir pulsar-site,
# pois no servidor o conteúdo já está achatado em $REMOTE_DOCKER_DIR).
cat > "$SITE_STAGING_DIR/$DOCKER_COMPOSE_FILE" <<'YAML'
services:
  pulsar:
    build:
      context: ./
      dockerfile: ./docker/pulsar-dockerfile
    container_name: pulsar-1
    restart: unless-stopped
    networks:
      - e-mec-network
    environment:
      - TZ=America/Sao_Paulo
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/healthz"]
      interval: 30s
      timeout: 5s
      retries: 3

networks:
  e-mec-network:
    external: true
YAML

sshpass -p "$PASSWORD" rsync -avz \
    -e "$RSYNC_SSH" \
    "$SITE_STAGING_DIR/$DOCKER_COMPOSE_FILE" \
    "$USER@$SERVER:$REMOTE_DOCKER_DIR/$DOCKER_COMPOSE_FILE"

echo -e "${GREEN}[5/6] Atualizando nginx público (home-app-1) e recarregando...${NC}"
# IMPORTANTE: home-app-1 tem o default.conf embutido via COPY no Dockerfile (sem
# volume mount). Atualizar /home/docker/nginx/default.conf no host + nginx -s reload
# NÃO aplica a nova config; é necessário rebuild + recreate do home-app-1.
# Aceita-se ~5-10s de downtime do e-mec (mesma janela já usada em renovações de cert).
if [ -f "$EMEC_PUBLIC_NGINX_CONF" ]; then
    if grep -q "pulsar.e-mec.net.br" "$EMEC_PUBLIC_NGINX_CONF"; then
        sshpass -p "$PASSWORD" rsync -avz \
            -e "$RSYNC_SSH" \
            "$EMEC_PUBLIC_NGINX_CONF" \
            "$USER@$SERVER:$EMEC_REMOTE_NGINX_CONF"

        # Verifica se cert cobre pulsar.e-mec.net.br
        CERT_OK=$(sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" \
            "openssl x509 -in /etc/letsencrypt/live/e-mec.net.br/fullchain.pem -noout -text 2>/dev/null | grep -c pulsar.e-mec.net.br || true")
        if [ "${CERT_OK:-0}" = "0" ]; then
            echo -e "${YELLOW}AVISO: Certificado em /etc/letsencrypt/live/e-mec.net.br/ NÃO cobre pulsar.e-mec.net.br${NC}"
            echo -e "${YELLOW}Execute no servidor antes de continuar:${NC}"
            echo -e "${YELLOW}  docker stop home-app-1 && \\${NC}"
            echo -e "${YELLOW}  certbot certonly --standalone --expand --non-interactive --agree-tos --cert-name e-mec.net.br \\${NC}"
            echo -e "${YELLOW}    -d e-mec.net.br -d www.e-mec.net.br -d app.e-mec.net.br -d api.e-mec.net.br -d admin.e-mec.net.br -d pulsar.e-mec.net.br && \\${NC}"
            echo -e "${YELLOW}  docker start home-app-1${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}AVISO: $EMEC_PUBLIC_NGINX_CONF não contém server block para pulsar.e-mec.net.br — pulando.${NC}"
    fi
else
    echo -e "${YELLOW}AVISO: $EMEC_PUBLIC_NGINX_CONF não encontrado localmente — pulando.${NC}"
fi

echo -e "${GREEN}[6/6] Build do pulsar + rebuild do nginx público (home-app-1)...${NC}"
sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" "
    set -e
    cd $REMOTE_DOCKER_DIR
    docker-compose -f $DOCKER_COMPOSE_FILE up -d --build pulsar

    # Rebuild home-app-1 se o default.conf no host divergir do que está no container.
    # Comparamos hashes; rebuild é caro (recreate do container) então só fazemos quando necessário.
    HOST_HASH=\$(sha256sum $EMEC_REMOTE_NGINX_CONF 2>/dev/null | awk '{print \$1}')
    CONTAINER_HASH=\$(docker exec home-app-1 sha256sum /etc/nginx/conf.d/default.conf 2>/dev/null | awk '{print \$1}' || echo 'missing')
    if [ \"\$HOST_HASH\" != \"\$CONTAINER_HASH\" ]; then
        echo 'home-app-1 default.conf desatualizado — rebuild...'
        cd $REMOTE_BASE_DIR && docker-compose -f $EMEC_COMPOSE_FILE up -d --build app
    else
        echo 'home-app-1 default.conf já sincronizado — sem rebuild.'
    fi

    # Sanity check
    docker exec home-app-1 nginx -t
"

echo -e "${GREEN}✓ Pulsar publicado.${NC}"
sshpass -p "$PASSWORD" ssh "${SSH_OPTS[@]}" "$USER@$SERVER" \
    "cd $REMOTE_DOCKER_DIR && docker-compose -f $DOCKER_COMPOSE_FILE ps pulsar"
