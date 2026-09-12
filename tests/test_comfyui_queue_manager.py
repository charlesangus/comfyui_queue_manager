#!/usr/bin/env python

"""Tests for `comfyui_queue_manager` package."""

import pytest
from src.comfyui_queue_manager.nodes import WorkflowName
from server import PromptServer


@pytest.fixture
def workflow_name_node():
    return WorkflowName()


@pytest.fixture(autouse=True)
def reset_prompt_queue():
    PromptServer.instance.prompt_queue.currently_running = {}
    yield
    PromptServer.instance.prompt_queue.currently_running = {}


def test_workflow_name_return_types():
    assert WorkflowName.RETURN_TYPES == ("STRING",)


def test_workflow_name_category():
    assert WorkflowName.CATEGORY == "Queue Manager"


def test_workflow_name_function():
    assert WorkflowName.FUNCTION == "run"


def test_workflow_name_returns_empty_when_no_workflow_running(workflow_name_node):
    result = workflow_name_node.run()
    assert result == ("",)


def test_workflow_name_returns_name_when_workflow_running(workflow_name_node):
    workflow_data = (None, None, None, {
        "extra_pnginfo": {
            "workflow": {
                "workflow_name": "Test Workflow"
            }
        }
    })
    PromptServer.instance.prompt_queue.currently_running[1] = workflow_data

    result = workflow_name_node.run()
    assert result == ("Test Workflow",)


def test_workflow_name_returns_empty_when_name_not_set(workflow_name_node):
    workflow_data = (None, None, None, {
        "extra_pnginfo": {
            "workflow": {}
        }
    })
    PromptServer.instance.prompt_queue.currently_running[1] = workflow_data

    result = workflow_name_node.run()
    assert result == ("",)


def test_workflow_name_returns_empty_when_extra_pnginfo_missing(workflow_name_node):
    workflow_data = (None, None, None, {})
    PromptServer.instance.prompt_queue.currently_running[1] = workflow_data

    result = workflow_name_node.run()
    assert result == ("",)
