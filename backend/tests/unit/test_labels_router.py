"""Unit tests for labels router — no database required."""

from unittest.mock import MagicMock, call, patch

import pytest
from fastapi import HTTPException

from app.models import CategoryEnum, Label, LABEL_SEED
from app.routers.labels import _seed_user_labels, create_label, delete_label, update_label
from app.schemas import LabelCreate, LabelUpdate


def _make_label(id: str, category: CategoryEnum, value: str, user_id: str | None = None) -> Label:
    label = Label(id=id, category=category, value=value, user_id=user_id)
    return label


# ── _seed_user_labels ─────────────────────────────────────────────────────────

class TestSeedUserLabels:
    def test_seeds_all_labels_for_new_user(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = []

        _seed_user_labels(db, "user-1")

        assert db.add.call_count == len(LABEL_SEED)
        added = [c[0][0] for c in db.add.call_args_list]
        assert all(l.user_id == "user-1" for l in added)
        assert {(l.category.value, l.value) for l in added} == set(LABEL_SEED)
        db.commit.assert_called_once()

    def test_skips_already_existing_labels(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [
            _make_label("e1", CategoryEnum.frequency, "daily", "user-1"),
        ]

        _seed_user_labels(db, "user-1")

        assert db.add.call_count == len(LABEL_SEED) - 1
        added = [c[0][0] for c in db.add.call_args_list]
        assert not any(
            l.category == CategoryEnum.frequency and l.value == "daily" for l in added
        )
        db.commit.assert_called_once()

    def test_seeds_nothing_when_fully_seeded(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.all.return_value = [
            _make_label(f"id-{i}", CategoryEnum(cat), val, "user-1")
            for i, (cat, val) in enumerate(LABEL_SEED)
        ]

        _seed_user_labels(db, "user-1")

        db.add.assert_not_called()
        db.commit.assert_called_once()


# ── create_label ──────────────────────────────────────────────────────────────

class TestCreateLabel:
    def test_creates_mode_label(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        db.refresh.side_effect = lambda l: setattr(l, "id", "new-id")

        result = create_label(LabelCreate(category="mode", value="  in-person  "), db, "user-1")

        db.add.assert_called_once()
        added = db.add.call_args[0][0]
        assert added.value == "in-person"
        assert added.user_id == "user-1"
        assert added.category == CategoryEnum.mode

    def test_rejects_frequency_category(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc:
            create_label(LabelCreate(category="frequency", value="hourly"), db, "user-1")
        assert exc.value.status_code == 400

    def test_rejects_unknown_category(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc:
            create_label(LabelCreate(category="bogus", value="x"), db, "user-1")
        assert exc.value.status_code == 400

    def test_rejects_empty_value(self):
        db = MagicMock()
        with pytest.raises(HTTPException) as exc:
            create_label(LabelCreate(category="mode", value="   "), db, "user-1")
        assert exc.value.status_code == 400

    def test_rejects_duplicate(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = _make_label(
            "x", CategoryEnum.mode, "online", "user-1"
        )
        with pytest.raises(HTTPException) as exc:
            create_label(LabelCreate(category="mode", value="online"), db, "user-1")
        assert exc.value.status_code == 409


# ── update_label ──────────────────────────────────────────────────────────────

class TestUpdateLabel:
    def test_renames_own_label(self):
        label = _make_label("l1", CategoryEnum.type, "raghav", "user-1")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [label, None]
        db.refresh.side_effect = lambda l: None

        result = update_label("l1", LabelUpdate(value="child"), db, "user-1")

        assert label.value == "child"
        db.commit.assert_called_once()

    def test_rejects_wrong_owner(self):
        label = _make_label("l1", CategoryEnum.mode, "online", "user-2")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = label

        with pytest.raises(HTTPException) as exc:
            update_label("l1", LabelUpdate(value="new"), db, "user-1")
        assert exc.value.status_code == 403

    def test_rejects_frequency_label(self):
        label = _make_label("l1", CategoryEnum.frequency, "daily", None)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = label

        with pytest.raises(HTTPException) as exc:
            update_label("l1", LabelUpdate(value="hourly"), db, "user-1")
        assert exc.value.status_code == 400  # category guard fires first

    def test_rejects_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc:
            update_label("missing", LabelUpdate(value="x"), db, "user-1")
        assert exc.value.status_code == 404

    def test_rejects_duplicate_value(self):
        label = _make_label("l1", CategoryEnum.mode, "online", "user-1")
        duplicate = _make_label("l2", CategoryEnum.mode, "phone", "user-1")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.side_effect = [label, duplicate]

        with pytest.raises(HTTPException) as exc:
            update_label("l1", LabelUpdate(value="phone"), db, "user-1")
        assert exc.value.status_code == 409


# ── delete_label ──────────────────────────────────────────────────────────────

class TestDeleteLabel:
    def test_deletes_own_label(self):
        label = _make_label("l1", CategoryEnum.type, "household", "user-1")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = label

        delete_label("l1", db, "user-1")

        db.delete.assert_called_once_with(label)
        db.commit.assert_called_once()

    def test_rejects_wrong_owner(self):
        label = _make_label("l1", CategoryEnum.type, "household", "user-2")
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = label

        with pytest.raises(HTTPException) as exc:
            delete_label("l1", db, "user-1")
        assert exc.value.status_code == 403

    def test_rejects_frequency_label(self):
        label = _make_label("l1", CategoryEnum.frequency, "daily", None)
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = label

        with pytest.raises(HTTPException) as exc:
            delete_label("l1", db, "user-1")
        assert exc.value.status_code == 400  # category guard fires first

    def test_rejects_not_found(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(HTTPException) as exc:
            delete_label("missing", db, "user-1")
        assert exc.value.status_code == 404
