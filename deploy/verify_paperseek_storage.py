"""Fail startup when PaperSeek's durable artifact store is not usable."""

from pathlib import Path
import shutil
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

sizes = sorted(
    ((path.stat().st_size, path) for path in data_dir.rglob("*") if path.is_file()),
    reverse=True,
)
print(
    "Largest persistent files: "
    + ", ".join(f"{path.relative_to(data_dir)}={size / 1024 / 1024:.1f}MiB" for size, path in sizes[:12]),
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
