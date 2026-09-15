#!/usr/bin/env bash
# Retira de AWS todo lo que crea scripts/deploy.sh.
#
#   bash scripts/teardown.sh        # pide confirmación
#   bash scripts/teardown.sh --yes  # sin confirmación
#
# Pasos: vaciar el bucket del frontend → sam delete (stack completo: CloudFront, EC2 con su
# volumen y datos, Lambda y su log group, IAM, security groups) → vaciar y borrar el bucket de
# artefactos → verificar que no queda nada.
#
# Usa las mismas variables que deploy.sh: STACK_NAME (por defecto portal-notas), AWS_REGION y
# ARTIFACT_BUCKET (por defecto <STACK_NAME>-artifacts-<cuenta>).
#
# Tarda ~10-20 min: CloudFront debe deshabilitarse antes de borrarse y Lambda libera las
# interfaces de red de la VPC con retraso. Los datos de la base de datos se pierden.

set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/aws-common.sh"

log "Contexto"
load_aws_context

if [[ "${1:-}" != "--yes" && "${1:-}" != "-y" ]]; then
  read -r -p "Se eliminarán el stack '$STACK_NAME', sus datos y s3://$ARTIFACT_BUCKET. ¿Continuar? [s/N] " answer
  [[ "$answer" =~ ^[sSyY]$ ]] || die "cancelado"
fi

STATUS="$(stack_status)"
if [[ -n "$STATUS" ]]; then
  log "Vaciando el bucket del frontend"
  # Desde los recursos del stack y no desde Outputs: también funciona si el stack quedó a medias.
  FRONTEND_BUCKET="$(aws_text cloudformation describe-stack-resource --stack-name "$STACK_NAME" \
    --logical-resource-id FrontendBucket --query StackResourceDetail.PhysicalResourceId 2>/dev/null || true)"
  if [[ -n "$FRONTEND_BUCKET" && "$FRONTEND_BUCKET" != "None" ]] && bucket_exists "$FRONTEND_BUCKET"; then
    aws s3 rm "s3://$FRONTEND_BUCKET" --recursive --only-show-errors
    echo "Vaciado s3://$FRONTEND_BUCKET"
  else
    echo "Sin bucket de frontend"
  fi

  log "Eliminando el stack $STACK_NAME ($STATUS)"
  "$SAM" delete --stack-name "$STACK_NAME" --region "$AWS_REGION" --no-prompts
else
  log "El stack $STACK_NAME no existe"
fi

log "Eliminando el bucket de artefactos"
if bucket_exists "$ARTIFACT_BUCKET"; then
  aws s3 rb "s3://$ARTIFACT_BUCKET" --force >/dev/null
  echo "Eliminado s3://$ARTIFACT_BUCKET"
else
  echo "s3://$ARTIFACT_BUCKET no existe"
fi

log "Verificación"
remaining="$(stack_status)"
[[ -z "$remaining" ]] || die "el stack $STACK_NAME sigue existiendo (estado $remaining)"
if [[ -n "${FRONTEND_BUCKET:-}" && "$FRONTEND_BUCKET" != "None" ]] && bucket_exists "$FRONTEND_BUCKET"; then
  die "el bucket s3://$FRONTEND_BUCKET sigue existiendo"
fi
! bucket_exists "$ARTIFACT_BUCKET" || die "el bucket s3://$ARTIFACT_BUCKET sigue existiendo"
echo "Retirada completa: no queda el stack ni los buckets de $STACK_NAME en $AWS_REGION."
