#!/usr/bin/env bash
# Smoke test del entorno completo (web → api → Lambda → PostgreSQL) con solo bash y curl.
#
#   docker compose up -d --build
#   bash scripts/smoke.sh
#
# Recorre: health → login admin → métricas → crear nota → moverla → métricas (+1) → eliminar
# → métricas (sin la nota) → logout → /me = 401. Las cifras se comparan de forma relativa, así
# que puede repetirse sobre cualquier base de datos. Sale con código ≠ 0 al primer fallo y
# elimina la nota de prueba si llegó a crearla.
#
# Variables opcionales:
#   BASE_URL        (por defecto http://localhost:8080, la app servida por nginx)
#   ADMIN_EMAIL     (por defecto admin@demo.test)
#   ADMIN_PASSWORD  (por defecto Admin123!)
#   WAIT_SECONDS    espera máxima a que /api/health responda (por defecto 90)

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:8080}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@demo.test}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!}"
WAIT_SECONDS="${WAIT_SECONDS:-90}"

WORK_DIR="$(mktemp -d)"
COOKIES="$WORK_DIR/cookies.txt"
RESPONSE="$WORK_DIR/response.json"
NOTE_ID=""
STATUS=""
BODY=""

cleanup() {
  if [[ -n "$NOTE_ID" ]]; then
    curl -s -o /dev/null -b "$COOKIES" -X DELETE "$BASE_URL/api/notes/$NOTE_ID" || true
  fi
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

ok() { printf '  ok     %s\n' "$1"; }

fail() {
  printf '  FALLO  %s\n' "$1" >&2
  if [[ -n "$BODY" ]]; then
    printf '         HTTP %s · %s\n' "$STATUS" "$BODY" >&2
  fi
  exit 1
}

# request MÉTODO RUTA [JSON] → deja el código en STATUS y el cuerpo en BODY.
request() {
  local method="$1" path="$2" data="${3:-}"
  local args=(-s -o "$RESPONSE" -w '%{http_code}' -b "$COOKIES" -c "$COOKIES" -X "$method")
  if [[ -n "$data" ]]; then
    args+=(-H 'Content-Type: application/json' --data "$data")
  fi
  STATUS="$(curl "${args[@]}" "$BASE_URL$path")" || STATUS="000"
  BODY="$(cat "$RESPONSE" 2>/dev/null || true)"
}

expect_status() {
  [[ "$STATUS" == "$1" ]] || fail "$2 (se esperaba HTTP $1)"
}

# json_number CAMPO / json_string CAMPO → primer valor de ese campo en BODY.
json_number() {
  grep -o "\"$1\":-\?[0-9]\+" <<<"$BODY" | head -n 1 | cut -d: -f2 || true
}
json_string() {
  grep -o "\"$1\":\"[^\"]*\"" <<<"$BODY" | head -n 1 | cut -d'"' -f4 || true
}

metrics_total() {
  request GET /api/metrics
  expect_status 200 "$1"
  grep -q '"source":"lambda"' <<<"$BODY" || fail "$1: la respuesta no viene de la Lambda"
  local total
  total="$(json_number total)"
  [[ -n "$total" ]] || fail "$1: la respuesta no incluye total"
  printf '%s' "$total"
}

echo "Smoke test contra $BASE_URL"

# 1. Salud: espera a que la API (y su conexión a la BD) responda a través de nginx.
deadline=$((SECONDS + WAIT_SECONDS))
until request GET /api/health && [[ "$STATUS" == "200" ]] && grep -q '"db":"ok"' <<<"$BODY"; do
  ((SECONDS < deadline)) || fail "GET /api/health no respondió ok en ${WAIT_SECONDS}s"
  sleep 2
done
ok "GET /api/health → status ok, db ok"

# 2. Sesión de administrador.
request POST /api/auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
expect_status 200 "POST /api/auth/login"
grep -q "\"role\":\"admin\"" <<<"$BODY" || fail "POST /api/auth/login: el usuario no es admin"
ok "POST /api/auth/login → 200 ($ADMIN_EMAIL)"

request GET /api/auth/me
expect_status 200 "GET /api/auth/me con sesión"
ok "GET /api/auth/me → 200"

# 3. Métricas iniciales calculadas por la Lambda.
total_before="$(metrics_total "GET /api/metrics inicial")"
ok "GET /api/metrics → total $total_before (source lambda)"

# 4. Crear nota.
title="smoke-$(date +%s)-$RANDOM"
request POST /api/notes "{\"title\":\"$title\",\"body\":\"creada por scripts/smoke.sh\",\"x\":120,\"y\":80}"
expect_status 201 "POST /api/notes"
NOTE_ID="$(json_string id)"
[[ -n "$NOTE_ID" ]] || fail "POST /api/notes: la respuesta no incluye id"
ok "POST /api/notes → 201 ($title)"

# 5. Moverla y comprobar que la posición queda guardada.
request PATCH "/api/notes/$NOTE_ID/position" '{"x":640,"y":360}'
expect_status 200 "PATCH /api/notes/:id/position"
[[ "$(json_number x)" == "640" && "$(json_number y)" == "360" ]] ||
  fail "PATCH /api/notes/:id/position: posición no aplicada"

request GET /api/notes
expect_status 200 "GET /api/notes"
grep -q "{\"id\":\"$NOTE_ID\"[^}]*\"x\":640,\"y\":360" <<<"$BODY" ||
  fail "GET /api/notes: la nota no aparece en (640, 360)"
ok "PATCH /api/notes/:id/position → (640, 360) persistida"

# 6. La Lambda cuenta la nota nueva.
total_after="$(metrics_total "GET /api/metrics tras crear")"
[[ "$total_after" -eq $((total_before + 1)) ]] ||
  fail "GET /api/metrics: total $total_after, se esperaba $((total_before + 1))"
ok "GET /api/metrics → total $total_after (+1)"

# 7. Eliminar la nota.
request DELETE "/api/notes/$NOTE_ID"
expect_status 204 "DELETE /api/notes/:id"
NOTE_ID=""
ok "DELETE /api/notes/:id → 204"

total_final="$(metrics_total "GET /api/metrics tras eliminar")"
[[ "$total_final" -eq "$total_before" ]] ||
  fail "GET /api/metrics: total $total_final, se esperaba $total_before"
ok "GET /api/metrics → total $total_final (vuelve al inicial)"

# 8. Cerrar sesión: la cookie deja de dar acceso.
request POST /api/auth/logout
expect_status 204 "POST /api/auth/logout"
ok "POST /api/auth/logout → 204"

request GET /api/auth/me
expect_status 401 "GET /api/auth/me tras logout"
ok "GET /api/auth/me → 401"

echo "Smoke test OK"
