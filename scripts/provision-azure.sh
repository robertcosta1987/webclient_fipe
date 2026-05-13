#!/usr/bin/env bash
# provision-azure.sh — stand up the Azure SQL serverless DB that backs the
# webclient demo. Idempotent against re-runs (skips create if it exists).
# Prints the connection string at the end so you can paste it into
# apps/webclient/.env.local.
#
# Cost: GP_S_Gen5_1 with 60min auto-pause + min vCore 0.5 ≈ R$ 25-40/month
# when idle. Tear down with: `az group delete -n <rg> --yes` (only safe if
# the RG holds nothing else you care about — this script reuses
# rg-dadocar-dev-brs).
set -euo pipefail

RG="${RG:-rg-dadocar-dev-brs}"
LOC="${LOC:-brazilsouth}"
DB_NAME="${DB_NAME:-carros_ativos_db}"
ADMIN_USER="${ADMIN_USER:-dadocaradmin}"

# Server name must be globally unique. Append a stable random suffix once,
# stored in a file so re-runs converge on the same name.
STATE_FILE="$(dirname "$0")/../.azure-provision.state"
if [ -f "$STATE_FILE" ]; then
  # shellcheck disable=SC1090
  source "$STATE_FILE"
else
  SFX="$(LC_ALL=C tr -dc 'a-z0-9' </dev/urandom | head -c 4)"
  echo "SFX=$SFX" > "$STATE_FILE"
fi
SERVER="dadocar-dev-sql-webclient-${SFX}-brs"

echo "==> ensuring Microsoft.Sql provider is registered"
az provider register --namespace Microsoft.Sql --wait

# Server
if az sql server show -g "$RG" -n "$SERVER" >/dev/null 2>&1; then
  echo "==> SQL server $SERVER already exists; reusing"
else
  PW="$(LC_ALL=C tr -dc 'A-Za-z0-9!@%' </dev/urandom | head -c 24)A1!"
  echo "==> creating SQL server $SERVER (location=$LOC, admin=$ADMIN_USER)"
  az sql server create \
    --name "$SERVER" --resource-group "$RG" --location "$LOC" \
    --admin-user "$ADMIN_USER" --admin-password "$PW" -o none
  echo "PW='$PW'" >> "$STATE_FILE"
  chmod 600 "$STATE_FILE"
fi
# shellcheck disable=SC1090
source "$STATE_FILE"

# DB
if az sql db show -g "$RG" -s "$SERVER" -n "$DB_NAME" >/dev/null 2>&1; then
  echo "==> DB $DB_NAME already exists; reusing"
else
  echo "==> creating DB $DB_NAME (GP_S_Gen5 1 vCore, min 0.5, auto-pause 60min)"
  az sql db create -g "$RG" -s "$SERVER" -n "$DB_NAME" \
    --edition GeneralPurpose --family Gen5 --capacity 1 \
    --compute-model Serverless --auto-pause-delay 60 --min-capacity 0.5 \
    --backup-storage-redundancy Local -o none
fi

# Firewall — allow Azure services + this machine
az sql server firewall-rule create -g "$RG" -s "$SERVER" \
  -n AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0 -o none 2>/dev/null || true

MY_IP="$(curl -s https://api.ipify.org || echo)"
if [ -n "$MY_IP" ]; then
  az sql server firewall-rule create -g "$RG" -s "$SERVER" \
    -n "AllowDev-${MY_IP//./_}" \
    --start-ip-address "$MY_IP" --end-ip-address "$MY_IP" -o none 2>/dev/null || true
  echo "==> firewall ok (azure-services + dev IP $MY_IP)"
fi

cat <<EOF

============================================================
Connection string for .env.local (DATABASE_URL):

Server=tcp:${SERVER}.database.windows.net,1433;Initial Catalog=${DB_NAME};Persist Security Info=False;User ID=${ADMIN_USER};Password=${PW};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;

After pasting it, run:  pnpm db:migrate
Then:                   pnpm dev
============================================================
EOF
