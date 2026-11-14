from fastapi.testclient import TestClient

from backend.server import app as app_module
from backend.server import server_utils


def test_public_demo_ignores_visitor_mcp_config(monkeypatch):
    monkeypatch.setenv("PUBLIC_DEMO_MODE", "1")

    command = server_utils.extract_command_data({
        "task": "demo",
        "report_type": "research_report",
        "mcp_enabled": True,
        "mcp_configs": [{"command": "visitor-command"}],
    })

    assert command[8] is False
    assert command[10] == []


def test_public_demo_hides_local_files(monkeypatch, tmp_path):
    monkeypatch.setenv("PUBLIC_DEMO_MODE", "1")
    monkeypatch.setattr(app_module, "DOC_PATH", str(tmp_path))
    (tmp_path / "private.txt").write_text("private", encoding="utf-8")

    with TestClient(app_module.app) as client:
        response = client.get("/files/")

    assert response.status_code == 200
    assert response.json() == {"files": []}


def test_public_demo_blocks_file_upload(monkeypatch):
    monkeypatch.setenv("PUBLIC_DEMO_MODE", "1")

    with TestClient(app_module.app) as client:
        response = client.post("/upload/", files={"file": ("demo.txt", b"demo")})

    assert response.status_code == 403


def test_public_demo_blocks_file_deletion(monkeypatch):
    monkeypatch.setenv("PUBLIC_DEMO_MODE", "1")

    with TestClient(app_module.app) as client:
        response = client.delete("/files/demo.txt")

    assert response.status_code == 403
