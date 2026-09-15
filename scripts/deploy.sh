#!/usr/bin/env bash
# Despliega el proyecto en AWS con AWS CLI v2 y SAM CLI (plantilla infra/template.yaml).
#
#   export DB_PASSWORD="$(openssl rand -hex 16)" JWT_SECRET="$(openssl rand -hex 32)"
#   bash scripts/deploy.sh
#
# Pasos: herramientas e identidad → bucket de artefactos → bundle de la API (api/ e infra/ec2 del
# commit actual) → sam build + sam deploy → build del frontend → subida a S3 → invalidación de
# CloudFront → URL y cuentas demo. La primera vez tarda ~15-20 min: la instancia construye las
# imágenes y el stack espera a que /api/health responda.
#
# Requisitos: cuenta de AWS con credenciales configuradas (aws configure / aws sso login /
# AWS_PROFILE) y permisos sobre CloudFormation, EC2, IAM, Lambda, S3, CloudFront y CloudWatch Logs;
# AWS CLI v2, SAM CLI, Node 22 + npm, git y bash (Git Bash, WSL, Linux o macOS). Docker no hace
# falta: la Lambda se empaqueta con esbuild y las imágenes de la API se construyen en EC2.
#
# Variables (* = obligatoria):
#   DB_PASSWORD *        contraseña de PostgreSQL: 12-64 caracteres [A-Za-z0-9._~-]
#   JWT_SECRET *         secreto del JWT de sesión: 32-256 caracteres [A-Za-z0-9._~-]
#   SEED_ADMIN_PASSWORD  contraseña de admin@demo.test   (por defecto Admin123!)
#   SEED_USER_PASSWORD   contraseña de usuario@demo.test (por defecto Usuario123!)
#                        8-72 caracteres [A-Za-z0-9!#*+.?@_~-]
#   STACK_NAME           nombre del stack (por defecto portal-notas)
#   AWS_REGION           región (por defecto la de `aws configure`, o us-east-1)
#   ARTIFACT_BUCKET      bucket de artefactos (por defecto <STACK_NAME>-artifacts-<cuenta>)
#   INSTANCE_TYPE        t3.micro (por defecto), t3.small o t3.medium
#   VPC_ID, SUBNET_ID    por defecto, la VPC por defecto y una subred suya donde exista
#                        INSTANCE_TYPE. Requisitos: DNS hostnames habilitado en la VPC y la subred
#                        con ruta a un Internet Gateway (la VPC por defecto cumple ambos).
#   KEY_NAME, ALLOWED_SSH_CIDR   opcionales, juntas: abren SSH (22) solo desde ese CIDR
#
# Importante:
#   - Las contraseñas quedan fijadas al crear la base de datos: no las cambies en un stack existente.
#   - Volver a ejecutar el script sobre un stack existente actualiza la Lambda y el frontend, pero la
#     API conserva el bundle con el que se creó (el UserData de EC2 solo corre en el primer
#     arranque). Para desplegar cambios de api/: scripts/teardown.sh y después este script.
#   - Retirada de todos los recursos: scripts/teardown.sh (con las mismas STACK_NAME, AWS_REGION y
#     ARTIFACT_BUCKET).

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/aws-common.sh"

SEED_ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-Admin123!}"
SEED_USER_PASSWORD="${SEED_USER_PASSWORD:-Usuario123!}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"

# Mismas restricciones que la plantilla (AllowedPattern + MinLength/MaxLength): se comprueban antes
# de crear nada. La longitud va aparte porque las regex de bash no admiten repeticiones > 255.
SECRET_CHARS_RE='^[A-Za-z0-9._~-]+$'
SEED_CHARS_RE='^[A-Za-z0-9!#*+.?@_~-]+$'
CIDR_RE='^([0-9]{1,3}\.){3}[0-9]{1,3}/([0-9]|[12][0-9]|3[0-2])$'

# valid VALOR REGEX MIN MAX
valid() {
  [[ "$1" =~ $2 ]] && ((${#1} >= $3 && ${#1} <= $4))
}

# ---------------------------------------------------------------------------------------------
log "1/6 Herramientas, parámetros e identidad"
# ---------------------------------------------------------------------------------------------
require_tools git node npm

[[ -n "${DB_PASSWORD:-}" ]] || die 'define DB_PASSWORD, p. ej. export DB_PASSWORD="$(openssl rand -hex 16)"'
[[ -n "${JWT_SECRET:-}" ]] || die 'define JWT_SECRET, p. ej. export JWT_SECRET="$(openssl rand -hex 32)"'
valid "$DB_PASSWORD" "$SECRET_CHARS_RE" 12 64 || die "DB_PASSWORD: 12-64 caracteres [A-Za-z0-9._~-]"
valid "$JWT_SECRET" "$SECRET_CHARS_RE" 32 256 || die "JWT_SECRET: 32-256 caracteres [A-Za-z0-9._~-]"
valid "$SEED_ADMIN_PASSWORD" "$SEED_CHARS_RE" 8 72 || die "SEED_ADMIN_PASSWORD: 8-72 caracteres [A-Za-z0-9!#*+.?@_~-]"
valid "$SEED_USER_PASSWORD" "$SEED_CHARS_RE" 8 72 || die "SEED_USER_PASSWORD: 8-72 caracteres [A-Za-z0-9!#*+.?@_~-]"
case "$INSTANCE_TYPE" in t3.micro | t3.small | t3.medium) ;; *) die "INSTANCE_TYPE: t3.micro, t3.small o t3.medium" ;; esac
if [[ -n "${KEY_NAME:-}${ALLOWED_SSH_CIDR:-}" ]]; then
  [[ -n "${KEY_NAME:-}" && "${ALLOWED_SSH_CIDR:-}" =~ $CIDR_RE ]] ||
    die "SSH: define KEY_NAME y ALLOWED_SSH_CIDR juntas (CIDR como 203.0.113.10/32)"
fi

load_aws_context

STATUS="$(stack_status)"
case "$STATUS" in
  *_IN_PROGRESS) die "el stack está en $STATUS; espera a que termine" ;;
  ROLLBACK_COMPLETE | ROLLBACK_FAILED | DELETE_FAILED | UPDATE_ROLLBACK_FAILED)
    die "el stack está en $STATUS y no se puede actualizar: ejecuta scripts/teardown.sh y vuelve a desplegar" ;;
esac

# ---------------------------------------------------------------------------------------------
log "2/6 Red (VPC y subred)"
# ---------------------------------------------------------------------------------------------
if [[ -z "${VPC_ID:-}" ]]; then
  VPC_ID="$(aws_text ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId')"
  [[ "$VPC_ID" == vpc-* ]] || die "no hay VPC por defecto en $AWS_REGION: define VPC_ID y SUBNET_ID"
fi
[[ "$(aws_text ec2 describe-vpc-attribute --vpc-id "$VPC_ID" --attribute enableDnsHostnames \
  --query EnableDnsHostnames.Value)" == "True" ]] ||
  die "la VPC $VPC_ID no tiene DNS hostnames habilitados (CloudFront necesita el DNS público de EC2)"

if [[ -z "${SUBNET_ID:-}" ]]; then
  zones="$(aws_text ec2 describe-instance-type-offerings --location-type availability-zone \
    --filters "Name=instance-type,Values=$INSTANCE_TYPE" --query 'InstanceTypeOfferings[].Location')"
  [[ -n "$zones" ]] || die "$INSTANCE_TYPE no está disponible en $AWS_REGION"
  SUBNET_ID="$(aws_text ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" \
    "Name=map-public-ip-on-launch,Values=true" "Name=availability-zone,Values=$(tr -s '\t\n' ',' <<<"$zones")" \
    --query 'sort_by(Subnets, &AvailabilityZone)[0].SubnetId')"
  [[ "$SUBNET_ID" == subnet-* ]] || die "no hay subred pública en $VPC_ID con $INSTANCE_TYPE: define SUBNET_ID"
fi
echo "VPC $VPC_ID · subred $SUBNET_ID · $INSTANCE_TYPE"

# ---------------------------------------------------------------------------------------------
log "3/6 Bucket de artefactos y bundle de la API"
# ---------------------------------------------------------------------------------------------
if ! bucket_exists "$ARTIFACT_BUCKET"; then
  if [[ "$AWS_REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" >/dev/null
  else
    aws s3api create-bucket --bucket "$ARTIFACT_BUCKET" \
      --create-bucket-configuration "LocationConstraint=$AWS_REGION" >/dev/null
  fi
  aws s3api put-public-access-block --bucket "$ARTIFACT_BUCKET" --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "Creado s3://$ARTIFACT_BUCKET"
fi

if [[ -n "$STATUS" ]]; then
  API_BUNDLE_KEY="$(aws_text cloudformation describe-stacks --stack-name "$STACK_NAME" \
    --query "Stacks[0].Parameters[?ParameterKey=='ApiBundleKey'].ParameterValue")"
  warn "el stack ya existe ($STATUS): la API conserva su bundle $API_BUNDLE_KEY."
  warn "Para desplegar cambios de api/: scripts/teardown.sh y de nuevo scripts/deploy.sh."
else
  # El bundle sale del commit (git archive), no del directorio de trabajo: exige que api/ e
  # infra/ec2 no tengan cambios sin commitear para que lo desplegado corresponda a un commit.
  [[ -z "$(git status --porcelain -- api infra/ec2)" ]] ||
    die "api/ o infra/ec2 tienen cambios sin commitear; el bundle se genera desde HEAD"
  API_BUNDLE_KEY="api/api-$(git rev-parse --short=12 HEAD).zip"
  mkdir -p .aws-sam/bundle
  bundle=".aws-sam/bundle/$(basename "$API_BUNDLE_KEY")"
  git archive --format=zip -o "$bundle" HEAD api infra/ec2
  aws s3 cp "$bundle" "s3://$ARTIFACT_BUCKET/$API_BUNDLE_KEY" --only-show-errors
  echo "Subido s3://$ARTIFACT_BUCKET/$API_BUNDLE_KEY"
fi

# ---------------------------------------------------------------------------------------------
log "4/6 sam build + sam deploy"
# ---------------------------------------------------------------------------------------------
# SAM busca esbuild en el PATH (en Windows no lo encuentra dentro del proyecto): se usa el de las
# devDependencies de la Lambda, la misma versión que su `npm run build`.
(cd lambda/metrics && npm ci --no-audit --no-fund)
PATH="$PWD/lambda/metrics/node_modules/.bin:$PATH" \
  "$SAM" build --template-file infra/template.yaml --build-dir .aws-sam/build

parameters=(
  "VpcId=$VPC_ID"
  "SubnetId=$SUBNET_ID"
  "InstanceType=$INSTANCE_TYPE"
  "ArtifactBucket=$ARTIFACT_BUCKET"
  "ApiBundleKey=$API_BUNDLE_KEY"
  "DbPassword=$DB_PASSWORD"
  "JwtSecret=$JWT_SECRET"
  "SeedAdminPassword=$SEED_ADMIN_PASSWORD"
  "SeedUserPassword=$SEED_USER_PASSWORD"
)
if [[ -n "${KEY_NAME:-}" ]]; then
  parameters+=("KeyName=$KEY_NAME" "AllowedSshCidr=$ALLOWED_SSH_CIDR")
fi

# --s3-bucket reutiliza el bucket de artefactos: --resolve-s3 crearía un stack aparte
# (aws-sam-cli-managed-default) que teardown.sh no retiraría.
"$SAM" deploy \
  --template-file .aws-sam/build/template.yaml \
  --stack-name "$STACK_NAME" \
  --region "$AWS_REGION" \
  --s3-bucket "$ARTIFACT_BUCKET" \
  --s3-prefix sam \
  --capabilities CAPABILITY_IAM \
  --no-confirm-changeset \
  --no-fail-on-empty-changeset \
  --parameter-overrides "${parameters[@]}"

CLOUDFRONT_URL="$(stack_output CloudFrontUrl)"
FRONTEND_BUCKET="$(stack_output FrontendBucketName)"
DISTRIBUTION_ID="$(stack_output DistributionId)"

# ---------------------------------------------------------------------------------------------
log "5/6 Frontend: build y subida a s3://$FRONTEND_BUCKET"
# ---------------------------------------------------------------------------------------------
(cd web && npm ci --no-audit --no-fund && npm run build)

# Mismas cabeceras que web/nginx.conf: assets/ con hash inmutables e index.html sin caché.
# Orden: primero los assets nuevos, luego index.html, y al final se borran los assets viejos, así
# nunca se sirve un index.html que apunte a archivos inexistentes.
aws s3 sync web/dist/assets "s3://$FRONTEND_BUCKET/assets" --only-show-errors \
  --cache-control "public, max-age=31536000, immutable"
aws s3 sync web/dist "s3://$FRONTEND_BUCKET" --only-show-errors --delete \
  --exclude "assets/*" --cache-control "no-cache"
aws s3 sync web/dist/assets "s3://$FRONTEND_BUCKET/assets" --only-show-errors --delete \
  --cache-control "public, max-age=31536000, immutable"

# ---------------------------------------------------------------------------------------------
log "6/6 Invalidación de CloudFront"
# ---------------------------------------------------------------------------------------------
invalidation="$(aws_text cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" \
  --paths "/*" --query Invalidation.Id)"
echo "Invalidación $invalidation en $DISTRIBUTION_ID"

cat <<EOF

Despliegue completado.

  URL:        $CLOUDFRONT_URL
  Cuentas:    admin@demo.test   (contraseña: SEED_ADMIN_PASSWORD, por defecto Admin123!)
              usuario@demo.test (contraseña: SEED_USER_PASSWORD, por defecto Usuario123!)

Si la distribución es nueva, CloudFront puede tardar unos minutos en responder. Comprobación:
  BASE_URL=$CLOUDFRONT_URL ADMIN_PASSWORD='$SEED_ADMIN_PASSWORD' bash scripts/smoke.sh

Retirada de todos los recursos:
  STACK_NAME=$STACK_NAME AWS_REGION=$AWS_REGION ARTIFACT_BUCKET=$ARTIFACT_BUCKET bash scripts/teardown.sh
EOF
