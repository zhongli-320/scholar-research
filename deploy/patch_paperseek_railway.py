"""Make PaperSeek's local artifact store compatible with Railway mounted volumes.

PaperSeek Community normally stages, fsyncs and hard-links artifacts. Some mounted
volumes reject one of those filesystem operations. Scholar Research runs a single
embedded PaperSeek worker, so an exclusive direct write keeps immutable keys while
avoiding unsupported cross-layer filesystem primitives.
"""

from pathlib import Path

path = Path("/usr/local/lib/python3.12/site-packages/paperseek_community/artifacts/files.py")
source = path.read_text()
start = source.index("    def put(self, artifact: ArtifactWrite) -> StoredArtifact:\n")
end = source.index("    def read(self, artifact: StoredArtifact) -> bytes:\n", start)
replacement = '''    def put(self, artifact: ArtifactWrite) -> StoredArtifact:
        target = self._target(artifact)
        digest = hashlib.sha256(artifact.content).hexdigest()
        if target.exists():
            return self._existing(artifact, target, digest)

        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with target.open("xb") as stream:
                stream.write(artifact.content)
                stream.flush()
        except FileExistsError:
            return self._existing(artifact, target, digest)
        except OSError as exc:
            target.unlink(missing_ok=True)
            raise ArtifactPersistenceError("The artifact could not be committed.") from exc

        return self._stored(artifact, target, digest)

'''
path.write_text(source[:start] + replacement + source[end:])
compile(path.read_text(), str(path), "exec")
