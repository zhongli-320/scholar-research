"""Fail startup when PaperSeek's durable artifact store is not usable."""

from uuid import uuid4

from paperseek_app.models import ArtifactRole, ArtifactVisibility, ArtifactWrite
from paperseek_community.artifacts.files import FileArtifactStore

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
