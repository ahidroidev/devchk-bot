#!/bin/bash

# 1. Obtener la rama actual
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 2. Solo actuar si estamos en la rama main
if [ "$CURRENT_BRANCH" == "main" ]; then
  echo "🚀 Society . E X E: Preparando despliegue en Main..."

  # 3. Incrementar versión en package.json (patch: 3.0.0 -> 3.0.1)
  # Usamos --no-git-tag-version porque el tag lo crearemos manualmente con el mensaje del commit
  NEW_VERSION=$(npm version patch --no-git-tag-version)

  # 4. Añadir cambios de versión
  git add package.json package-lock.json

  # 5. Unir el cambio de versión al commit que estás intentando subir
  git commit --amend --no-edit

  # 6. Crear un Tag automático con la nueva versión (ej: v3.0.1)
  echo "🏷️ Creando Tag: $NEW_VERSION"
  git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION: Deployment automático"

  echo "✅ Versión $NEW_VERSION lista para el push."
else
  echo "ℹ️ Branch '$CURRENT_BRANCH' detectada. Se omite el versionado automático."
fi