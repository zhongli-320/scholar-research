import json

import pytest


@pytest.mark.asyncio
async def test_completed_detached_job_is_saved_under_browser_run_id(monkeypatch, tmp_path):
    from backend.server import server_utils
    from backend.server.report_store import ReportStore

    class ClosedSocket:
        async def send_json(self, data):
            raise RuntimeError("disconnected")

    class Manager:
        async def start_streaming(self, *args, logs_handler=None, **kwargs):
            assert logs_handler is not None
            await logs_handler.send_json({"type": "report", "output": "# saved report"})
            return "# saved report"

    async def fake_files(report, filename):
        return {"md": "outputs/report.md"}

    store_path = tmp_path / "reports.json"
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("REPORT_STORE_PATH", str(store_path))
    monkeypatch.setattr(server_utils, "generate_report_files", fake_files)
    command = "start " + json.dumps({
        "task": "detached question",
        "research_id": "run-123",
        "report_type": "research_report",
        "report_source": "web",
        "tone": "Objective",
    })

    await server_utils.handle_start_command(ClosedSocket(), command, Manager())

    report = await ReportStore(store_path).get_report("run-123")
    assert report is not None
    assert report["answer"] == "# saved report"
    assert [event["type"] for event in report["orderedData"] if event.get("type")] == ["report", "path"]
