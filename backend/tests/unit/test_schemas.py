"""Unit tests for schemas.py — TaskLink validation. No database required."""

import pytest
from pydantic import ValidationError

from app.schemas import MAX_TASK_LINKS, TaskCreate, TaskLink, TaskUpdate, validate_task_links


def _link(url="https://example.com", description="Example", id="l1"):
    return {"id": id, "url": url, "description": description}


# ── TaskLink field validation ───────────────────────────────────────────────

class TestTaskLinkValidation:
    def test_accepts_http_url(self):
        link = TaskLink.model_validate(_link(url="http://example.com"))
        assert link.url == "http://example.com"

    def test_accepts_https_url(self):
        link = TaskLink.model_validate(_link(url="https://example.com"))
        assert link.url == "https://example.com"

    def test_rejects_javascript_scheme(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate(_link(url="javascript:alert(1)"))

    def test_rejects_data_scheme(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate(_link(url="data:text/html,<script>alert(1)</script>"))

    def test_rejects_mailto_scheme(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate(_link(url="mailto:test@example.com"))

    def test_rejects_schemeless_url(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate(_link(url="example.com"))

    def test_rejects_empty_description(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate(_link(description=""))

    def test_rejects_whitespace_only_description(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate(_link(description="   "))

    def test_rejects_oversized_description(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate(_link(description="x" * 201))

    def test_rejects_oversized_url(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate(_link(url="https://example.com/" + "x" * 2048))

    def test_requires_id(self):
        with pytest.raises(ValidationError):
            TaskLink.model_validate({"url": "https://example.com", "description": "Example"})


# ── TaskCreate / TaskUpdate links cap ───────────────────────────────────────

class TestTaskLinksCap:
    def test_task_create_accepts_up_to_max(self):
        links = [_link(id=f"l{i}") for i in range(MAX_TASK_LINKS)]
        task = TaskCreate(title="Test", links=links)
        assert len(task.links) == MAX_TASK_LINKS

    def test_task_create_rejects_over_max(self):
        links = [_link(id=f"l{i}") for i in range(MAX_TASK_LINKS + 1)]
        with pytest.raises(ValidationError):
            TaskCreate(title="Test", links=links)

    def test_task_create_defaults_to_empty_list(self):
        task = TaskCreate(title="Test")
        assert task.links == []

    def test_task_update_links_defaults_to_none(self):
        task = TaskUpdate()
        assert task.links is None

    def test_task_update_accepts_empty_list_as_explicit_clear(self):
        task = TaskUpdate(links=[])
        assert task.links == []

    def test_task_update_rejects_over_max(self):
        links = [_link(id=f"l{i}") for i in range(MAX_TASK_LINKS + 1)]
        with pytest.raises(ValidationError):
            TaskUpdate(links=links)


# ── validate_task_links (shared helper used by sync.py) ────────────────────

class TestValidateTaskLinks:
    def test_none_returns_empty_list(self):
        assert validate_task_links(None) == []

    def test_empty_list_returns_empty_list(self):
        assert validate_task_links([]) == []

    def test_valid_links_pass_through(self):
        result = validate_task_links([_link()])
        assert len(result) == 1
        assert isinstance(result[0], TaskLink)

    def test_rejects_over_max(self):
        links = [_link(id=f"l{i}") for i in range(MAX_TASK_LINKS + 1)]
        with pytest.raises(ValueError):
            validate_task_links(links)

    def test_rejects_bad_scheme(self):
        with pytest.raises(ValidationError):
            validate_task_links([_link(url="javascript:alert(1)")])
