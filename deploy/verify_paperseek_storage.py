"""Fail startup when PaperSeek's durable artifact store is not usable."""

from uuid import uuid4
from pathlib import Path
import sqlite3

from paperseek_app.models import ArtifactRole, ArtifactVisibility, ArtifactWrite
from paperseek_community.artifacts.files import FileArtifactStore

database = Path("/data/paperseek-artifacts.db")
cleanup_marker = Path("/data/.paperseek-checkpoints-pruned-v1")
if database.exists() and not cleanup_marker.exists():
    with sqlite3.connect(database, timeout=30, isolation_level=None) as connection:
        connection.execute("PRAGMA busy_timeout = 30000")
        table_exists = connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'artifact_blobs'"
        ).fetchone()
        deleted = 0
        if table_exists:
            deleted = connection.execute(
                "DELETE FROM artifact_blobs WHERE storage_key LIKE '%/checkpoint/%'"
            ).rowcount
            connection.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    cleanup_marker.touch()
    print(f"Pruned {deleted} legacy PaperSeek checkpoints", flush=True)

store = FileArtifactStore("/data")
draft = ArtifactWrite(
    run_id=str(uuid4()),
    kind="checkpoint",
    role=ArtifactRole.RECOVERY,
    visibility=ArtifactVisibility.INTERNAL,
    filename="state-startup-smoke.json",
    media_type="application/json",
    schema_version=1,
    content=b'{"storage":"ok"}',
)
stored = store.put(draft)
assert store.read(stored) == draft.content
store.delete(stored)
print("PaperSeek artifact storage check passed", flush=True)
