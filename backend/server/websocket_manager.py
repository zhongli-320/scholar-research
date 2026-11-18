import os
import asyncio
import datetime
import json
import logging
import os
import traceback
from contextlib import suppress
from typing import Dict, List

from fastapi import WebSocket

from backend.report_type import BasicReport, DetailedReport

from gpt_researcher.utils.enum import ReportType, Tone
from gpt_researcher.actions import stream_output  # Import stream_output
from .multi_agent_runner import run_multi_agent_task
from .server_utils import CustomLogsHandler

logger = logging.getLogger(__name__)

_research_limit = int(os.getenv("MAX_CONCURRENT_RESEARCH", "0"))
_research_semaphore = asyncio.Semaphore(_research_limit) if _research_limit > 0 else None

class WebSocketManager:
    """Manage websockets"""

    def __init__(self):
        """Initialize the WebSocketManager class."""
        self.active_connections: List[WebSocket] = []
        self.sender_tasks: Dict[WebSocket, asyncio.Task] = {}
        self.message_queues: Dict[WebSocket, asyncio.Queue] = {}

    async def start_sender(self, websocket: WebSocket):
        """Start the sender task."""
        queue = self.message_queues.get(websocket)
        if not queue:
            return

        while True:
            try:
                message = await queue.get()
                if message is None:  # Shutdown signal
                    break
                    
                if websocket in self.active_connections:
                    if message == "ping":
                        await websocket.send_text("pong")
                    else:
                        await websocket.send_text(message)
                else:
                    break
            except Exception as e:
                print(f"Error in sender task: {e}")
                break

    async def connect(self, websocket: WebSocket):
        """Connect a websocket."""
        try:
            await websocket.accept()
            self.active_connections.append(websocket)
            self.message_queues[websocket] = asyncio.Queue()
            self.sender_tasks[websocket] = asyncio.create_task(
                self.start_sender(websocket))
        except Exception as e:
            print(f"Error connecting websocket: {e}")
            if websocket in self.active_connections:
                await self.disconnect(websocket)

    async def disconnect(self, websocket: WebSocket):
        """Disconnect a websocket and release all per-connection resources."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

        queue = self.message_queues.pop(websocket, None)
        sender = self.sender_tasks.pop(websocket, None)
        if queue is not None:
            with suppress(asyncio.QueueFull):
                queue.put_nowait(None)
        if sender is not None:
            sender.cancel()
            with suppress(asyncio.CancelledError):
                await sender

        try:
            await websocket.close()
        except Exception as exc:
            logger.info(f"WebSocket already closed: {exc}")

    async def start_streaming(self, task, report_type, report_source, source_urls, document_urls, tone, websocket, headers=None, query_domains=[], mcp_enabled=False, mcp_strategy="fast", mcp_configs=[], max_search_results=None):
        """Start streaming the output."""
        tone = Tone[tone]
        # add customized JSON config file path here
        config_path = os.environ.get("CONFIG_PATH", "default")

        # Pass MCP parameters to run_agent
        report = await run_agent(
            task, report_type, report_source, source_urls, document_urls, tone, websocket, 
            headers=headers, query_domains=query_domains, config_path=config_path,
            mcp_enabled=mcp_enabled, mcp_strategy=mcp_strategy, mcp_configs=mcp_configs,
            max_search_results=max_search_results
        )
        return report

def _release_task_memory() -> None:
    """Collect task-local cycles and return free glibc arenas when possible."""
    import gc

    gc.collect()
    if os.name == "posix":
        try:
            import ctypes

            ctypes.CDLL("libc.so.6").malloc_trim(0)
        except (OSError, AttributeError):
            pass


async def run_agent(*args, **kwargs):
    try:
        if _research_semaphore:
            async with _research_semaphore:
                return await _run_agent(*args, **kwargs)
        return await _run_agent(*args, **kwargs)
    finally:
        _release_task_memory()


async def _run_agent(task, report_type, report_source, source_urls, document_urls, tone: Tone, websocket, stream_output=stream_output, headers=None, query_domains=[], config_path="", return_researcher=False, mcp_enabled=False, mcp_strategy="fast", mcp_configs=[], max_search_results=None):
    """Run the agent."""    
    # Create logs handler for this research task
    logs_handler = CustomLogsHandler(websocket, task)

    # Log MCP initialization. Retriever and strategy are configured per-request
    # inside GPTResearcher via mcp_configs/mcp_strategy params — no os.environ
    # mutation needed here (mutating os.environ would persist across requests and
    # affect unrelated sessions, see issue #1676).
    if mcp_enabled and mcp_configs:
        print(f"🔧 MCP enabled with strategy '{mcp_strategy}' and {len(mcp_configs)} server(s)")
        await logs_handler.send_json({
            "type": "logs",
            "content": "mcp_init",
            "output": f"🔧 MCP enabled with strategy '{mcp_strategy}' and {len(mcp_configs)} server(s)"
        })

    # Initialize researcher based on report type
    if report_type == "multi_agents":
        report = await run_multi_agent_task(
            query=task, 
            websocket=logs_handler,  # Use logs_handler instead of raw websocket
            stream_output=stream_output, 
            tone=tone, 
            headers=headers
        )
        report = report.get("report", "")

    elif report_type == ReportType.DetailedReport.value:
        researcher = DetailedReport(
            query=task,
            query_domains=query_domains,
            report_type=report_type,
            report_source=report_source,
            source_urls=source_urls,
            document_urls=document_urls,
            tone=tone,
            config_path=config_path,
            websocket=logs_handler,  # Use logs_handler instead of raw websocket
            headers=headers,
            mcp_configs=mcp_configs if mcp_enabled else None,
            mcp_strategy=mcp_strategy if mcp_enabled else None,
            max_search_results=max_search_results,
        )
        report = await researcher.run()
        
    else:
        researcher = BasicReport(
            query=task,
            query_domains=query_domains,
            report_type=report_type,
            report_source=report_source,
            source_urls=source_urls,
            document_urls=document_urls,
            tone=tone,
            config_path=config_path,
            websocket=logs_handler,  # Use logs_handler instead of raw websocket
            headers=headers,
            mcp_configs=mcp_configs if mcp_enabled else None,
            mcp_strategy=mcp_strategy if mcp_enabled else None,
            max_search_results=max_search_results,
        )
        report = await researcher.run()

    if report_type != "multi_agents" and return_researcher:
        return report, researcher.gpt_researcher
    else:
        return report
