"""
Unit tests for the DataGuardian Incident Injection & Simulation CLI (simulate_incident.py).
Validates simulation dataset integrity, incident catalog, and mocked injection flows.
"""

import os
import pytest
import pandas as pd
from unittest.mock import MagicMock, patch

from scripts.simulate_incident import (
    AVAILABLE_INCIDENTS,
    inject_null_spike,
    inject_schema_drift,
    inject_duplicates,
    reset_clean_data,
    INCIDENT_DIR,
    RAW_SEED_DIR
)


def test_incident_datasets_exist_and_valid():
    """Verify that all incident simulation CSV files exist and have data."""
    for key, info in AVAILABLE_INCIDENTS.items():
        file_path = os.path.join(INCIDENT_DIR, info["file"])
        assert os.path.exists(file_path), f"Missing simulation file: {file_path}"
        df = pd.read_csv(file_path)
        assert len(df) > 0, f"Simulation file is empty: {file_path}"


def test_null_spike_dataset_has_elevated_nulls():
    """Verify that null_spike_orders.csv contains > 30% nulls in order_status."""
    csv_path = os.path.join(INCIDENT_DIR, "null_spike_orders.csv")
    df = pd.read_csv(csv_path)
    assert "order_status" in df.columns
    null_ratio = df["order_status"].isna().mean()
    assert null_ratio > 0.30, f"Expected elevated null ratio, found {null_ratio:.2%}"


def test_schema_drift_dataset_has_renamed_column():
    """Verify that schema_drift_customers.csv has postal_code_drifted instead of customer_zip_code_prefix."""
    csv_path = os.path.join(INCIDENT_DIR, "schema_drift_customers.csv")
    df = pd.read_csv(csv_path)
    assert "postal_code_drifted" in df.columns
    assert "customer_zip_code_prefix" not in df.columns


def test_duplicates_dataset_has_duplicated_records():
    """Verify duplicate_payments.csv contains duplicate records."""
    csv_path = os.path.join(INCIDENT_DIR, "duplicate_payments.csv")
    df = pd.read_csv(csv_path)
    dup_count = df.duplicated(subset=["order_id", "payment_sequential"]).sum()
    assert dup_count > 0, "Expected duplicate rows in duplicate_payments.csv"


def test_inject_null_spike_mocked():
    """Test inject_null_spike with a mocked database engine."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    with patch("pandas.DataFrame.to_sql") as mock_to_sql:
        result = inject_null_spike(engine=mock_engine)
        assert result is True
        assert mock_to_sql.called
        assert mock_conn.execute.called


def test_inject_schema_drift_mocked():
    """Test inject_schema_drift with a mocked database engine."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    with patch("pandas.DataFrame.to_sql") as mock_to_sql:
        result = inject_schema_drift(engine=mock_engine)
        assert result is True
        assert mock_to_sql.called
        assert mock_conn.execute.called


def test_inject_duplicates_mocked():
    """Test inject_duplicates with a mocked database engine."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    with patch("pandas.DataFrame.to_sql") as mock_to_sql:
        result = inject_duplicates(engine=mock_engine)
        assert result is True
        assert mock_to_sql.called
        assert mock_conn.execute.called


def test_reset_clean_data_mocked():
    """Test reset_clean_data with mocked schema reset and loader."""
    mock_engine = MagicMock()
    mock_conn = MagicMock()
    mock_engine.begin.return_value.__enter__.return_value = mock_conn

    with patch("scripts.simulate_incident.init_raw_tables") as mock_init, \
         patch("scripts.simulate_incident.load_data") as mock_load:
        mock_load.return_value = {"customers": 5000, "orders": 5000}
        result = reset_clean_data(engine=mock_engine)
        assert result is True
        assert mock_init.called
        assert mock_load.called
