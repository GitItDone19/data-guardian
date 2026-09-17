"""
Unit tests for the DataGuardian QualityEngine & QualityRules.
Validates statistical metric evaluations, threshold assertions, and incident emission logic.
"""

import pytest
from unittest.mock import MagicMock
from backend.services.quality_rules import QualityRule, DEFAULT_QUALITY_RULES
from backend.services.quality_engine import QualityEngine, QualityCheckResult


def test_quality_rules_catalog_structure():
    """Verify that all default rules have valid types, thresholds, and severity."""
    assert len(DEFAULT_QUALITY_RULES) >= 5

    valid_types = {"null_rate", "volume_bounds", "duplicate_rate", "value_range", "schema_drift"}
    valid_severities = {"CRITICAL", "WARNING"}

    for rule in DEFAULT_QUALITY_RULES:
        assert rule.rule_id.startswith("QR_")
        assert "." in rule.table_name
        assert rule.rule_type in valid_types
        assert rule.severity in valid_severities
        assert len(rule.description) > 5


def test_check_null_rate_passed():
    engine = QualityEngine(engine=MagicMock())
    rule = QualityRule(
        rule_id="TEST_NULL_PASS",
        table_name="raw.orders",
        rule_type="null_rate",
        column_name="order_status",
        description="Null rate <= 2%",
        params={"max_null_rate": 0.02}
    )

    mock_conn = MagicMock()
    # Return (total_rows=1000, null_rows=5) -> 0.5% null rate
    mock_conn.execute.return_value.fetchone.return_value = (1000, 5)

    result = engine.evaluate_rule(mock_conn, rule)
    assert result.status == "PASSED"
    assert "0.50%" in result.actual_value


def test_check_null_rate_failed():
    engine = QualityEngine(engine=MagicMock())
    rule = QualityRule(
        rule_id="TEST_NULL_FAIL",
        table_name="raw.orders",
        rule_type="null_rate",
        column_name="order_status",
        description="Null rate <= 2%",
        params={"max_null_rate": 0.02}
    )

    mock_conn = MagicMock()
    # Return (total_rows=1000, null_rows=450) -> 45% null rate
    mock_conn.execute.return_value.fetchone.return_value = (1000, 450)

    result = engine.evaluate_rule(mock_conn, rule)
    assert result.status == "FAILED"
    assert "45.00%" in result.actual_value
    assert "exceeding threshold" in result.message


def test_check_volume_bounds_passed():
    engine = QualityEngine(engine=MagicMock())
    rule = QualityRule(
        rule_id="TEST_VOL_PASS",
        table_name="raw.orders",
        rule_type="volume_bounds",
        description="Volume between 4000 and 6000",
        params={"min_rows": 4000, "max_rows": 6000}
    )

    mock_conn = MagicMock()
    mock_conn.execute.return_value.scalar.return_value = 5000

    result = engine.evaluate_rule(mock_conn, rule)
    assert result.status == "PASSED"
    assert "5,000 rows" in result.actual_value


def test_check_volume_bounds_failed():
    engine = QualityEngine(engine=MagicMock())
    rule = QualityRule(
        rule_id="TEST_VOL_FAIL",
        table_name="raw.orders",
        rule_type="volume_bounds",
        description="Volume between 4000 and 6000",
        params={"min_rows": 4000, "max_rows": 6000}
    )

    mock_conn = MagicMock()
    # Anomaly: only 250 rows ingested
    mock_conn.execute.return_value.scalar.return_value = 250

    result = engine.evaluate_rule(mock_conn, rule)
    assert result.status == "FAILED"
    assert "250 rows" in result.actual_value
    assert "outside the expected bound" in result.message


def test_check_duplicate_rate():
    engine = QualityEngine(engine=MagicMock())
    rule = QualityRule(
        rule_id="TEST_DUP_FAIL",
        table_name="raw.payments",
        rule_type="duplicate_rate",
        column_name="order_id, payment_sequential",
        description="No duplicates",
        params={"max_duplicate_rate": 0.0}
    )

    mock_conn = MagicMock()
    # 1000 rows total, 15 duplicates found
    mock_conn.execute.return_value.fetchone.return_value = (1000, 15)

    result = engine.evaluate_rule(mock_conn, rule)
    assert result.status == "FAILED"
    assert "1.50%" in result.actual_value
    assert "duplicate rows" in result.message


def test_check_value_range():
    engine = QualityEngine(engine=MagicMock())
    rule = QualityRule(
        rule_id="TEST_VAL_RANGE",
        table_name="raw.payments",
        rule_type="value_range",
        column_name="payment_value",
        description="payment_value >= 0",
        params={"min_value": 0.0}
    )

    mock_conn = MagicMock()
    # 5 out-of-bounds rows (e.g. negative payment amounts)
    mock_conn.execute.return_value.fetchone.return_value = (1000, 5)

    result = engine.evaluate_rule(mock_conn, rule)
    assert result.status == "FAILED"
    assert "5 out-of-bounds rows" in result.actual_value


def test_check_schema_drift():
    engine = QualityEngine(engine=MagicMock())
    rule = QualityRule(
        rule_id="TEST_SCHEMA_DRIFT",
        table_name="raw.customers",
        rule_type="schema_drift",
        description="Check required columns exist",
        params={"required_columns": ["customer_id", "customer_unique_id", "customer_zip_code_prefix"]}
    )

    mock_conn = MagicMock()
    # Simulated drift: customer_zip_code_prefix renamed to postal_code_drifted
    mock_conn.execute.return_value.fetchall.return_value = [
        ("customer_id",),
        ("customer_unique_id",),
        ("postal_code_drifted",)
    ]

    result = engine.evaluate_rule(mock_conn, rule)
    assert result.status == "FAILED"
    assert "customer_zip_code_prefix" in result.message
    assert "Schema Drift Detected" in result.message


def test_emit_incident_id_generation():
    """Verify that emitting an incident produces a standard INC_DQ identifier."""
    mock_engine = MagicMock()
    engine = QualityEngine(engine=mock_engine)

    rule = QualityRule(
        rule_id="QR_TEST_EMIT",
        table_name="raw.orders",
        rule_type="null_rate",
        column_name="order_status",
        description="Test null rate rule",
        severity="CRITICAL"
    )

    check_result = QualityCheckResult(
        rule=rule,
        status="FAILED",
        actual_value="45.0%",
        expected_threshold="<= 2.0%",
        message="Simulated test failure",
        details={"null_rows": 450, "total_rows": 1000}
    )

    incident_id = engine.emit_incident(check_result)
    assert incident_id.startswith("INC_DQ_raw_orders_QR_TEST_EMIT_")
    assert check_result.incident_id == incident_id
