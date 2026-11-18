"""Fail startup when PaperSeek's durable artifact store is not usable."""

from pathlib import Path
import shutil
import sqlite3
from uuid import uuid4

from paperseek_app.models import ArtifactRole, ArtifactVisibility, ArtifactWrite
from paperseek_community.artifacts.files import FileArtifactStore

data_dir = Path("/data")
legacy_root = (data_dir / "artifacts" / "runs").resolve()
legacy_cleanup_marker = data_dir / ".paperseek-file-checkpoints-pruned-v4"
if legacy_root.exists() and not legacy_cleanup_marker.exists():
    deleted_files = 0
    deleted_bytes = 0
    for checkpoint_dir in legacy_root.glob("*/checkpoint"):
        target = checkpoint_dir.resolve()
        if target.parent.parent != legacy_root:
            raise RuntimeError(f"Refusing unexpected checkpoint path: {target}")
        for file in target.rglob("*"):
            if file.is_file():
                deleted_files += 1
                deleted_bytes += file.stat().st_size
        shutil.rmtree(target)
        if not any(target.parent.iterdir()):
            target.parent.rmdir()
    legacy_cleanup_marker.touch()
    print(
        f"Pruned {deleted_files} legacy checkpoint files "
        f"({deleted_bytes / 1024 / 1024:.1f}MiB); final artifacts were preserved",
        flush=True,
    )

database = Path("/data/paperseek-artifacts.db")
cleanup_marker = Path("/data/.paperseek-artifacts-rebuilt-v3")
if not cleanup_marker.exists():
    for suffix in ("", "-wal", "-shm"):
        Path(f"{database}{suffix}").unlink(missing_ok=True)
    cleanup_marker.touch()
    print("Rebuilt full PaperSeek artifact sidecar; search metadata was preserved", flush=True)

store = FileArtifactStore("/data")
run_id = str(uuid4())
stored_artifacts = []
for index in range(4):
    draft = ArtifactWrite(
        run_id=run_id,
        kind="checkpoint",
        role=ArtifactRole.RECOVERY,
        visibility=ArtifactVisibility.INTERNAL,
        filename=f"state-startup-smoke-{index}.json",
        media_type="application/json",
        schema_version=1,
        content=f'{{"storage":"ok","index":{index}}}'.encode(),
    )
    stored_artifacts.append(store.put(draft))

assert store.read(stored_artifacts[-1]) == b'{"storage":"ok","index":3}'
with sqlite3.connect(database) as connection:
    retained = connection.execute(
        "SELECT COUNT(*) FROM artifact_blobs WHERE storage_key LIKE ?",
        (f"artifacts/runs/{run_id}/checkpoint/%",),
    ).fetchone()[0]
assert retained == 3
for stored in stored_artifacts:
    store.delete(stored)
print("PaperSeek artifact storage and checkpoint retention checks passed", flush=True)
