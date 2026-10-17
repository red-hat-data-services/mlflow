# ODH downstream: covers the experiment kind backfill added to the skill registry migration.
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command

from mlflow.store.db.utils import _get_alembic_config
from mlflow.store.tracking.dbmodels.initial_models import Base as InitialBase

pytestmark = pytest.mark.notrackingurimock

REVISION = "e7d1f4b2a9c6"
PREVIOUS_REVISION = "dc11669786a5"
KIND = "mlflow.experimentKind"

_EXPERIMENTS = sa.table(
    "experiments",
    sa.column("experiment_id"),
    sa.column("name"),
    sa.column("workspace"),
    sa.column("lifecycle_stage"),
)
_EXPERIMENT_TAGS = sa.table(
    "experiment_tags", sa.column("key"), sa.column("value"), sa.column("experiment_id")
)
_TRACE_INFO = sa.table(
    "trace_info",
    sa.column("request_id"),
    sa.column("experiment_id"),
    sa.column("timestamp_ms"),
    sa.column("status"),
)


def _prepare_database(tmp_path: Path):
    db_url = f"sqlite:///{tmp_path / 'experiment_kind_backfill.sqlite'}"
    engine = sa.create_engine(db_url)
    InitialBase.metadata.create_all(engine)
    config = _get_alembic_config(db_url)
    command.upgrade(config, PREVIOUS_REVISION)
    return engine, config


def _kinds(engine) -> dict[int, str]:
    with engine.connect() as conn:
        rows = conn.execute(
            sa.select(_EXPERIMENT_TAGS.c.experiment_id, _EXPERIMENT_TAGS.c.value).where(
                _EXPERIMENT_TAGS.c.key == KIND
            )
        )
        return dict(rows.all())


def test_skill_registry_migration_backfills_kind_of_traced_experiments(tmp_path: Path):
    engine, config = _prepare_database(tmp_path)
    experiments = [
        # (id, workspace, has traces, existing kind)
        (101, "team-a", True, None),
        (102, "team-b", True, None),
        (103, "team-a", True, "custom_model_development"),
        (104, "team-a", False, None),
    ]
    with engine.begin() as conn:
        for experiment_id, workspace, has_traces, kind in experiments:
            conn.execute(
                sa.insert(_EXPERIMENTS).values(
                    experiment_id=experiment_id,
                    name=f"experiment-{experiment_id}",
                    workspace=workspace,
                    lifecycle_stage="active",
                )
            )
            if kind:
                conn.execute(
                    sa.insert(_EXPERIMENT_TAGS).values(
                        key=KIND, value=kind, experiment_id=experiment_id
                    )
                )
            if has_traces:
                # Two traces, to check the experiment is tagged once
                for n in range(2):
                    conn.execute(
                        sa.insert(_TRACE_INFO).values(
                            request_id=f"tr-{experiment_id}-{n}",
                            experiment_id=experiment_id,
                            timestamp_ms=0,
                            status="OK",
                        )
                    )

    command.upgrade(config, REVISION)

    assert _kinds(engine) == {
        101: "genai_development_inferred",
        102: "genai_development_inferred",
        103: "custom_model_development",
    }


def test_skill_registry_migration_downgrade_keeps_backfilled_kinds(tmp_path: Path):
    engine, config = _prepare_database(tmp_path)
    with engine.begin() as conn:
        conn.execute(
            sa.insert(_EXPERIMENTS).values(
                experiment_id=101, name="traced", workspace="default", lifecycle_stage="active"
            )
        )
        conn.execute(
            sa.insert(_TRACE_INFO).values(
                request_id="tr-101", experiment_id=101, timestamp_ms=0, status="OK"
            )
        )
    command.upgrade(config, REVISION)

    command.downgrade(config, PREVIOUS_REVISION)
    # Re-upgrading must not fail on the tag the first upgrade inserted
    command.upgrade(config, REVISION)

    assert _kinds(engine) == {101: "genai_development_inferred"}
