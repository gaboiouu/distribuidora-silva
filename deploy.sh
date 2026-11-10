#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")"
for tool in docker curl python3 flock; do command -v "$tool" >/dev/null || { echo "Falta $tool" >&2; exit 1; }; done
exec 9>.deploy.lock
flock -n 9 || { echo 'Ya hay un despliegue en curso'; exit 1; }
trap 'echo "Despliegue falló. No se revierten migraciones automáticamente; revisa logs y README." >&2' ERR
[[ -f .env ]] || { echo 'Copia .env.example a .env y configura el servidor'; exit 1; }
docker compose version >/dev/null
docker info >/dev/null
# Compose interpreta .env; nunca ejecutar su contenido como un script.
config_file="$(mktemp)"
chmod 600 "$config_file"
trap 'rm -f "$config_file"' EXIT
docker compose config --format json > "$config_file"
readarray -t settings < <(python3 - "$config_file" <<'CHECK'
import json,sys
c=json.load(open(sys.argv[1])); b=c['services']['backend']; e=b['environment']; domain=c['services']['proxy']['environment']['API_DOMAIN']
if len(e['JWT_SECRET'])<48 or any('REPLACE' in str(v) for v in e.values()) or domain.endswith('example.com'):
 sys.exit('Configura secretos y un dominio real antes de desplegar')
if not e['CORS_ORIGIN'].startswith('https://'): sys.exit('CORS_ORIGIN debe usar HTTPS')
print(b['image']); print(domain)
CHECK
)
[[ ${#settings[@]} -eq 2 ]] || exit 1
image="${settings[0]}"
domain="${settings[1]}"
if [[ "${DEPLOY_PULL_ONLY:-0}" == 1 ]]; then
 docker pull "$image"
else
 args=()
 [[ -z "${CODEX_PROXY_CERT:-}" ]] || args+=(--secret "id=proxy_ca,src=$CODEX_PROXY_CERT")
 docker build "${args[@]}" -t "$image" backend
 docker push "$image"
fi
docker compose up -d --wait db
# Copia previa; primera instalación también produce una copia vacía válida.
mkdir -p backups
chmod 700 backups
umask 077
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > "backups/predeploy-$(date -u +%Y%m%dT%H%M%SZ).sql"
docker compose run --rm --no-deps backend npx prisma migrate deploy
docker compose up -d --wait --wait-timeout 120 backend proxy
curl --fail --silent --show-error --retry 8 --retry-all-errors --retry-delay 3 --max-time 15 "https://$domain/api/v1/health"
echo "Backend disponible en https://$domain"
echo 'Frontend pendiente de implementación; no se publica ni se comprueba en esta etapa.'
