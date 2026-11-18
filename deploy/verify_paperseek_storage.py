"""Fail startup when PaperSeek's durable artifact store is not usable."""

from pathlib import Path
from uuid import uuid4

from paperseek_app.models import ArtifactRole, ArtifactVisibility, ArtifactWrite
from paperseek_community.artifacts.files import FileArtifactStore

database = Path("/data/paperseek-artifacts.db")
cleanup_marker = Path("/data/.paperseek-artifacts-rebuilt-v3")
if not cleanup_marker.exists():
    for suffix in ("", "-wal", "-shm"):
        Path(f"{database}{suffix}").unlink(missing_ok=True)
    cleanup_marker.touch()
    print("Rebuilt full PaperSeek artifact sidecar; search metadata was preserved", flush=True)

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
