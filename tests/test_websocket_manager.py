import importlib
import asyncio
import os
import sys
import types
import unittest
from enum import Enum
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]


def _load_websocket_manager_module():
    for path in (ROOT, ROOT / "backend"):
        path_str = str(path)
        if path_str not in sys.path:
            sys.path.insert(0, path_str)

    fastapi_module = types.ModuleType("fastapi")
    fastapi_module.WebSocket = type("WebSocket", (), {})

    report_type_module = types.ModuleType("backend.report_type")
    report_type_module.BasicReport = type("BasicReport", (), {})
    report_type_module.DetailedReport = type("DetailedReport", (), {})

    enum_module = types.ModuleType("gpt_researcher.utils.enum")

    class ReportType(Enum):
        DetailedReport = "detailed_report"

    class Tone(Enum):
        Objective = "objective"

    enum_module.ReportType = ReportType
    enum_module.Tone = Tone

    actions_module = types.ModuleType("gpt_researcher.actions")
    actions_module.stream_output = lambda *args, **kwargs: None

    multi_agent_runner_module = types.ModuleType("backend.server.multi_agent_runner")

    async def run_multi_agent_task(*args, **kwargs):
        return {"report": "stub-report"}

    multi_agent_runner_module.run_multi_agent_task = run_multi_agent_task

    server_utils_module = types.ModuleType("backend.server.server_utils")
    server_utils_module.CustomLogsHandler = type("CustomLogsHandler", (), {})

    with patch.dict(
        sys.modules,
        {
            "fastapi": fastapi_module,
            "report_type": report_type_module,
            "backend.report_type": report_type_module,
            "gpt_researcher.utils.enum": enum_module,
            "gpt_researcher.actions": actions_module,
            "backend.server.multi_agent_runner": multi_agent_runner_module,
            "backend.server.server_utils": server_utils_module,
        },
    ):
        # Popped inside the patch so the real module comes back afterwards.
        sys.modules.pop("backend.server.websocket_manager", None)
        return importlib.import_module("backend.server.websocket_manager")


class WebSocketManagerTests(unittest.IsolatedAsyncioTestCase):
    def test_websocket_manager_module_imports(self):
        module = importlib.import_module("backend.server.websocket_manager")
        self.assertTrue(hasattr(module, "WebSocketManager"))

    def test_server_app_module_imports(self):
        module = importlib.import_module("backend.server.app")
        self.assertTrue(hasattr(module, "app"))

    async def test_start_streaming_reads_config_path_from_environment(self):
        websocket_manager = _load_websocket_manager_module()
        manager = websocket_manager.WebSocketManager()
        call_kwargs = {}
        logs_handler = object()

        async def fake_run_agent(*args, **kwargs):
            call_kwargs.update(kwargs)
            return "stub-report"

        websocket_manager.run_agent = fake_run_agent

        with patch.dict(os.environ, {"CONFIG_PATH": "custom-config"}, clear=False):
            report = await manager.start_streaming(
                task="test-task",
                report_type="research_report",
                report_source="web",
                source_urls=[],
                document_urls=[],
                tone="Objective",
                websocket=object(),
                logs_handler=logs_handler,
            )

        self.assertEqual(report, "stub-report")
        self.assertEqual(call_kwargs["config_path"], "custom-config")
        self.assertIs(call_kwargs["logs_handler"], logs_handler)

    async def test_run_agent_caps_global_research_concurrency(self):
        with patch.dict(os.environ, {"MAX_CONCURRENT_RESEARCH": "2"}, clear=False):
            websocket_manager = _load_websocket_manager_module()

        state = {"active": 0, "peak": 0}

        class FakeReport:
            def __init__(self, **kwargs):
                pass

            async def run(self):
                state["active"] += 1
                state["peak"] = max(state["peak"], state["active"])
                await asyncio.sleep(0.02)
                state["active"] -= 1
                return "stub-report"

        websocket_manager.BasicReport = FakeReport
        websocket_manager.CustomLogsHandler = lambda websocket, task: websocket

        await asyncio.gather(*(
            websocket_manager.run_agent(
                task=f"task-{index}",
                report_type="research_report",
                report_source="web",
                source_urls=[],
                document_urls=[],
                tone=websocket_manager.Tone.Objective,
                websocket=object(),
            )
            for index in range(4)
        ))

        self.assertLessEqual(state["peak"], 2)


if __name__ == "__main__":
    unittest.main()
