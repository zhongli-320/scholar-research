"""Store PaperSeek artifacts in a Railway-safe SQLite sidecar.

The Community artifact adapter normally relies on staged files, fsync and hard links.
Railway's mounted volume used by this deployment rejects that artifact commit path.
SQLite is already the durable store for PaperSeek metadata on the same volume, so the
adapter below keeps immutable artifact blobs in a separate SQLite database while
preserving the public ArtifactStore contract and legacy file reads.
"""

from pathlib import Path

path = Path("/usr/local/lib/python3.12/site-packages/paperseek_community/artifacts/files.py")
source = path.read_text().replace("import re\n", "import re\nimport sqlite3\nimport zlib\n")
start = source.index("    def put(self, artifact: ArtifactWrite) -> StoredArtifact:\n")
end = source.index("    def _prune_empty_parents(self, directory: Path) -> None:\n", start)
replacement = '''    def _blob_connection(self):
        database = self.data_dir / "paperseek-artifacts.db"
        connection = sqlite3.connect(database, timeout=30, isolation_level=None)
        connection.execute("PRAGMA busy_timeout = 30000")
        connection.execute("PRAGMA journal_mode = WAL")
        connection.execute("PRAGMA synchronous = NORMAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS artifact_blobs (
                storage_key TEXT PRIMARY KEY,
                sha256 TEXT NOT NULL,
                size INTEGER NOT NULL,
                content BLOB NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        return connection

    def put(self, artifact: ArtifactWrite) -> StoredArtifact:
        target = self._target(artifact)
        storage_key = target.relative_to(self.data_dir).as_posix()
        digest = hashlib.sha256(artifact.content).hexdigest()
        stored_content = b"PSZ1" + zlib.compress(artifact.content, level=1)
        created_at = datetime.now(timezone.utc)
        try:
            with self._blob_connection() as connection:
                existing = connection.execute(
                    "SELECT sha256, size, created_at FROM artifact_blobs WHERE storage_key = ?",
                    (storage_key,),
                ).fetchone()
                if existing is not None:
                    if existing[0] != digest or int(existing[1]) != len(artifact.content):
                        raise ArtifactConflict(
                            "An immutable artifact key already contains different content."
                        )
                    created_at = datetime.fromisoformat(existing[2])
                else:
                    connection.execute(
                        """
                        INSERT INTO artifact_blobs
                            (storage_key, sha256, size, content, created_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            storage_key,
                            digest,
                            len(artifact.content),
                            sqlite3.Binary(stored_content),
                            created_at.isoformat(),
                        ),
                    )
                if "/checkpoint/" in storage_key:
                    connection.execute(
                        """
                        DELETE FROM artifact_blobs
                        WHERE storage_key IN (
                            SELECT storage_key
                            FROM artifact_blobs
                            WHERE storage_key LIKE ?
                            ORDER BY created_at DESC
                            LIMIT -1 OFFSET 3
                        )
                        """,
                        (f"artifacts/runs/{artifact.run_id}/checkpoint/%",),
                    )
        except ArtifactConflict as exc:
            print(
                f"PaperSeek artifact conflict run={artifact.run_id} key={storage_key}: {exc}",
                flush=True,
            )
            raise
        except (OSError, sqlite3.Error, ValueError) as exc:
            print(
                f"PaperSeek artifact put failed run={artifact.run_id} key={storage_key} "
                f"size={len(artifact.content)} error={type(exc).__name__}: {exc}",
                flush=True,
            )
            raise ArtifactPersistenceError("The artifact could not be committed.") from exc

        artifact_id = str(
            uuid5(NAMESPACE_URL, f"paperseek:{artifact.run_id}:{storage_key}:{digest}")
        )
        return StoredArtifact(
            id=artifact_id,
            run_id=artifact.run_id,
            kind=artifact.kind,
            role=artifact.role,
            visibility=artifact.visibility,
            filename=artifact.filename,
            media_type=artifact.media_type,
            storage_key=storage_key,
            sha256=digest,
            size=len(artifact.content),
            schema_version=artifact.schema_version,
            created_at=created_at,
        )

    def read(self, artifact: StoredArtifact) -> bytes:
        try:
            with self._blob_connection() as connection:
                row = connection.execute(
                    "SELECT content, sha256, size FROM artifact_blobs WHERE storage_key = ?",
                    (artifact.storage_key,),
                ).fetchone()
        except (OSError, sqlite3.Error) as exc:
            raise ArtifactPersistenceError("The artifact could not be read.") from exc
        if row is not None:
            content = bytes(row[0])
            if content.startswith(b"PSZ1"):
                try:
                    content = zlib.decompress(content[4:])
                except zlib.error as exc:
                    raise ArtifactIntegrityError("The compressed artifact is invalid.") from exc
            if int(row[2]) != artifact.size or len(content) != artifact.size:
                raise ArtifactIntegrityError("The artifact size does not match its metadata.")
            if row[1] != artifact.sha256 or hashlib.sha256(content).hexdigest() != artifact.sha256:
                raise ArtifactIntegrityError("The artifact checksum does not match its metadata.")
            return content

        # Artifacts written before this compatibility adapter remain readable.
        path = self._storage_path(artifact.storage_key)
        try:
            content = path.read_bytes()
        except OSError as exc:
            raise ArtifactPersistenceError("The artifact could not be read.") from exc
        if len(content) != artifact.size:
            raise ArtifactIntegrityError("The artifact size does not match its metadata.")
        if hashlib.sha256(content).hexdigest() != artifact.sha256:
            raise ArtifactIntegrityError("The artifact checksum does not match its metadata.")
        return content

    def delete(self, artifact: StoredArtifact) -> None:
        try:
            with self._blob_connection() as connection:
                connection.execute(
                    "DELETE FROM artifact_blobs WHERE storage_key = ?",
                    (artifact.storage_key,),
                )
            path = self._storage_path(artifact.storage_key)
            if path.exists():
                path.unlink()
                self._prune_empty_parents(path.parent)
        except (OSError, sqlite3.Error) as exc:
            raise ArtifactPersistenceError("The artifact could not be deleted.") from exc

'''
path.write_text(source[:start] + replacement + source[end:])
compile(path.read_text(), str(path), "exec")
