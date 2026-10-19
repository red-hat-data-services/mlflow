#!/bin/bash
set -ex

cd tests/db

# Keep the rhoai-3.5 migration baseline at MLflow 3.10.1. Lock SQLAlchemy and the PostgreSQL
# drivers to the project environment, while allowing the older MLflow to resolve its own
# application dependencies (its PyArrow and Huey requirements differ from this branch).
locked=$(mktemp)
uv run --no-sync python - <<'PYTHON' > "$locked"
from importlib.metadata import version

for package in ("sqlalchemy", "psycopg2-binary", "psycopg", "psycopg-binary"):
    print(f"{package}=={version(package)}")
PYTHON
uv run --isolated --no-project --with mlflow==3.10.1 --with-requirements "$locked" \
  python check_migration.py pre-migration
# Run the post-migration step with mlflow from the repository
uv run --no-sync mlflow db upgrade $MLFLOW_TRACKING_URI
uv run --no-sync python check_migration.py post-migration
