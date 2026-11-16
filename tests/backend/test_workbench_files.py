import asyncio
from backend.server import app as app_module


def test_files_probe_does_not_create_directory(monkeypatch, tmp_path):
    missing = tmp_path / "missing"
    monkeypatch.delenv("PUBLIC_DEMO_MODE", raising=False)
    monkeypatch.setattr(app_module, "DOC_PATH", str(missing))
    assert asyncio.run(app_module.list_files()) == {"files": []}
    assert not missing.exists()


def test_upload_creates_directory(monkeypatch, tmp_path):
    missing = tmp_path / "missing"
    monkeypatch.delenv("PUBLIC_DEMO_MODE", raising=False)
    monkeypatch.setattr(app_module, "DOC_PATH", str(missing))
    async def upload(file, path):
        assert missing.is_dir()
        return {"filename": "test"}
    monkeypatch.setattr(app_module, "handle_file_upload", upload)
    assert asyncio.run(app_module.upload_file(None)) == {"filename": "test"}
