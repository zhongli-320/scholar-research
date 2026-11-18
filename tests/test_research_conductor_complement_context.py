from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from gpt_researcher.skills.researcher import ResearchConductor


class DummyRetriever:
    pass


@pytest.mark.parametrize(
    ("complement_source_urls", "additional_research", "expected_context"),
    [
        (True, "web context", "source context web context"),
        (True, [], "source context"),
        (False, "unused web context", "source context"),
    ],
)
@pytest.mark.asyncio
async def test_complementary_web_context_is_joined_without_corruption(
    complement_source_urls, additional_research, expected_context
):
    researcher = SimpleNamespace(
        query="test query",
        source_urls=["https://example.com/source"],
        complement_source_urls=complement_source_urls,
        agent="agent",
        role="role",
        retrievers=[DummyRetriever],
        cfg=SimpleNamespace(curate_sources=False),
        verbose=False,
        query_domains=[],
    )
    conductor = ResearchConductor(researcher)
    conductor.json_handler = None
    conductor._get_context_by_urls = AsyncMock(return_value="source context")
    conductor._get_context_by_web_search = AsyncMock(return_value=additional_research)

    result = await conductor.conduct_research()

    assert result == expected_context
    assert researcher.context == result
    conductor._get_context_by_urls.assert_awaited_once_with(
        ["https://example.com/source"]
    )
    if complement_source_urls:
        conductor._get_context_by_web_search.assert_awaited_once_with(
            "test query", [], []
        )
    else:
        conductor._get_context_by_web_search.assert_not_awaited()


@pytest.mark.asyncio
async def test_planning_results_replace_redundant_original_subquery():
    researcher = SimpleNamespace(
        retrievers=[],
        cfg=SimpleNamespace(mcp_strategy="disabled"),
        report_type="research_report",
        verbose=False,
        websocket=None,
    )
    conductor = ResearchConductor(researcher)
    conductor._get_initial_search_results = AsyncMock(return_value=[{"url": "https://example.com"}])
    conductor.plan_research = AsyncMock(return_value=["planned one", "planned two", "planned three"])
    conductor._get_context_from_initial_results = AsyncMock(return_value="original context")
    conductor._process_sub_query = AsyncMock(side_effect=lambda query, *_: f"context for {query}")

    result = await conductor._get_context_by_web_search("original question")

    assert result == "original context context for planned one context for planned two context for planned three"
    assert [call.args[0] for call in conductor._process_sub_query.await_args_list] == [
        "planned one",
        "planned two",
        "planned three",
    ]
