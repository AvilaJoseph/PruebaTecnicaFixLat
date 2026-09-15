# Configuración y utilidades comunes de scripts/deploy.sh y scripts/teardown.sh (se carga con
# `source`). Deja el directorio de trabajo en la raíz del repositorio.

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Git Bash (Windows) convierte argumentos que parecen rutas POSIX, p. ej. --paths "/*" en una
# ruta de Windows. Se desactiva, y por eso los scripts solo pasan rutas relativas a la raíz.
export MSYS_NO_PATHCONV=1

STACK_NAME="${STACK_NAME:-portal-notas}"

log() { printf '\n==> %s\n' "$*"; }
warn() { printf 'AVISO: %s\n' "$*" >&2; }
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_tools() {
  local tool
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || die "no se encontró '$tool' en el PATH"
  done
}

# En Windows, SAM CLI solo instala sam.cmd.
resolve_sam() {
  if command -v sam >/dev/null 2>&1; then
    SAM=sam
  elif command -v sam.cmd >/dev/null 2>&1; then
    SAM=sam.cmd
  else
    die "no se encontró SAM CLI (sam) en el PATH"
  fi
}

# Salida de texto de la AWS CLI sin el \r que añade en Windows.
aws_text() {
  aws "$@" --output text | tr -d '\r'
}

# Valida STACK_NAME y las credenciales; fija AWS_REGION, ACCOUNT_ID, ARTIFACT_BUCKET y SAM.
load_aws_context() {
  [[ "$STACK_NAME" =~ ^[a-z][a-z0-9-]{0,39}$ ]] ||
    die "STACK_NAME debe tener 1-40 caracteres (minúsculas, números y guiones) y empezar por letra"

  require_tools aws
  resolve_sam

  if [[ -z "${AWS_REGION:-}" ]]; then
    AWS_REGION="$(aws configure get region 2>/dev/null | tr -d '\r' || true)"
    AWS_REGION="${AWS_REGION:-us-east-1}"
  fi
  export AWS_REGION AWS_DEFAULT_REGION="$AWS_REGION"

  ACCOUNT_ID="$(aws_text sts get-caller-identity --query Account)" ||
    die "no hay credenciales de AWS válidas (aws configure, aws sso login o AWS_PROFILE)"
  ARTIFACT_BUCKET="${ARTIFACT_BUCKET:-$STACK_NAME-artifacts-$ACCOUNT_ID}"

  printf 'Cuenta %s · región %s · stack %s · artefactos s3://%s\n' \
    "$ACCOUNT_ID" "$AWS_REGION" "$STACK_NAME" "$ARTIFACT_BUCKET"
}

# Estado del stack, o vacío si no existe.
stack_status() {
  aws_text cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query 'Stacks[0].StackStatus' 2>/dev/null || true
}

stack_output() {
  aws_text cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue"
}

bucket_exists() {
  aws s3api head-bucket --bucket "$1" >/dev/null 2>&1
}
