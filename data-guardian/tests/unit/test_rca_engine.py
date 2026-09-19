"""
Unit tests for Phase 9: Root Cause Analysis (RCA) Engine.
Validates Pydantic schema constraints, empirical synthesis, LLM fallback, and node integration.
"""

import pytest
from unittest.mock import MagicMock, patch
from pydantic import ValidationError

from agent.graph.state import IncidentState
from agent.services.rca_engine import (
    RCAReportModel,
    EvidenceCitation,
    RecommendedFix,
    synthesize_empirical_rca,
    generate_root_cause_analysis
)
from agent.graph.nodes import node_generate_rca


def test_rca_report_pydantic_validation():
    """Verify that RCAReportModel strictly validates all fields and confidence bounds."""
    report = RCAReportModel(
        incident_id="INC_VALID_01",
        failure_type="SCHEMA_DRIFT",
        target_table="raw.customers",
        title="Schema Drift on Customers",
        root_cause_summary="Column postal_code_drifted appeared instead of customer_zip_code_prefix.",
        technical_details="Underlying Postgres column has changed.",
        blast_radius=["staging.stg_customers"],
        evidence_citations=[
            EvidenceCitation(
                evidence_type="SCHEMA",
                source="raw.customers",
                finding="Column postal_code_drifted exists."
            )
        ],
        recommended_fix=RecommendedFix(
            strategy="RENAME_COLUMN_ALIAS",
            target_file="dbt/models/staging/stg_customers.sql",
            suggested_sql_or_action="COALESCE(postal_code_drifted, customer_zip_code_prefix) AS customer_zip_code_prefix"
        ),
        confidence_score=0.986
    )

    assert report.incident_id == "INC_VALID_01"
    assert report.confidence_score == 0.99  # Validates rounding
    assert len(report.evidence_citations) == 1

    # Test invalid confidence score > 1.0
    with pytest.raises(ValidationError):
        RCAReportModel(
            incident_id="INC_INVALID",
            failure_type="SCHEMA_DRIFT",
            target_table="raw.customers",
            title="Title",
            root_cause_summary="Summary text here",
            technical_details="Details",
            evidence_citations=[],  # Must have at least 1 citation
            recommended_fix=report.recommended_fix,
            confidence_score=1.5
        )


def test_synthesize_empirical_rca_schema_drift():
    """Verify empirical RCA generation for Schema Drift incidents."""
    state: IncidentState = {
        "incident_id": "INC_SCHEMA_DRIFT_001",
        "failure_type": "SCHEMA_DRIFT",
        "target_table": "raw.customers",
        "raw_error": "Schema Drift: Missing required column customer_zip_code_prefix",
        "schema_evidence": {
            "has_schema_drift": True,
            "missing_expected_columns": ["customer_zip_code_prefix"],
            "existing_columns": ["customer_id", "postal_code_drifted"]
        }
    }

    report = synthesize_empirical_rca(state)

    assert isinstance(report, RCAReportModel)
    assert report.failure_type == "SCHEMA_DRIFT"
    assert "postal_code_drifted" in report.root_cause_summary
    assert report.recommended_fix.strategy == "RENAME_COLUMN_ALIAS"
    assert "stg_customers.sql" in report.recommended_fix.target_file
    assert any(c.evidence_type == "SCHEMA" for c in report.evidence_citations)
    assert report.confidence_score >= 0.95


def test_synthesize_empirical_rca_null_spike():
    """Verify empirical RCA generation for high null rate anomalies."""
    state: IncidentState = {
        "incident_id": "INC_NULL_SPIKE_002",
        "failure_type": "DATA_QUALITY_ANOMALY",
        "target_table": "raw.orders",
        "raw_error": "Null rate anomaly in raw.orders.order_status: 42% nulls",
        "data_evidence": {
            "corrupted_samples": [{"order_id": "1", "order_status": None}]
        }
    }

    report = synthesize_empirical_rca(state)

    assert isinstance(report, RCAReportModel)
    assert report.failure_type == "DATA_QUALITY_ANOMALY"
    assert "order_status" in report.root_cause_summary
    assert report.recommended_fix.strategy == "IMPUTE_NULLS_OR_QUARANTINE"
    assert "stg_orders.sql" in report.recommended_fix.target_file
    assert any(c.evidence_type == "DATA_SAMPLE" for c in report.evidence_citations)


def test_synthesize_empirical_rca_duplicates():
    """Verify empirical RCA generation for duplicate records."""
    state: IncidentState = {
        "incident_id": "INC_DUP_003",
        "failure_type": "DATA_QUALITY_ANOMALY",
        "target_table": "raw.payments",
        "raw_error": "Duplicate records detected across composite key",
        "data_evidence": {
            "corrupted_samples": [{"order_id": "ORD1", "payment_sequential": 1, "count": 2}]
        }
    }

    report = synthesize_empirical_rca(state)

    assert report.failure_type == "DATA_QUALITY_ANOMALY"
    assert report.recommended_fix.strategy == "DEDUPLICATE_WINDOW_FUNCTION"
    assert "stg_payments.sql" in report.recommended_fix.target_file
    assert "ROW_NUMBER()" in report.recommended_fix.suggested_sql_or_action


def test_node_generate_rca_integration():
    """Verify node_generate_rca integration and IncidentState return contract."""
    state: IncidentState = {
        "incident_id": "INC_INT_001",
        "failure_type": "SCHEMA_DRIFT",
        "target_table": "raw.customers",
        "raw_error": "Missing customer_zip_code_prefix",
        "schema_evidence": {
            "has_schema_drift": True,
            "missing_expected_columns": ["customer_zip_code_prefix"],
            "existing_columns": ["postal_code_drifted"]
        }
    }

    res = node_generate_rca(state)

    assert res["status"] == "RCA_GENERATED"
    assert isinstance(res["root_cause_analysis"], dict)
    assert "postal_code_drifted" in res["rca_narrative"]
    assert res["confidence_score"] >= 0.90
    assert "COALESCE" in res["proposed_sql_fix"]


def test_generate_root_cause_analysis_with_mocked_llm():
    """Verify LLM execution branch when OPENAI_API_KEY is configured."""
    mock_llm_output = {
        "incident_id": "INC_LLM_001",
        "failure_type": "SCHEMA_DRIFT",
        "target_table": "raw.customers",
        "title": "LLM Diagnosed Schema Drift",
        "root_cause_summary": "Upstream service pushed postal_code_drifted instead of customer_zip_code_prefix.",
        "technical_details": "Schema diff indicates renaming without deprecation notice.",
        "blast_radius": ["staging.stg_customers"],
        "evidence_citations": [
            {
                "evidence_type": "SCHEMA",
                "source": "raw.customers",
                "finding": "Found postal_code_drifted"
            }
        ],
        "recommended_fix": {
            "strategy": "RENAME_COLUMN_ALIAS",
            "target_file": "dbt/models/staging/stg_customers.sql",
            "suggested_sql_or_action": "SELECT postal_code_drifted AS customer_zip_code_prefix FROM raw.customers"
        },
        "confidence_score": 0.97
    }

    import json
    mock_response = MagicMock()
    mock_response.content = f"```json\n{json.dumps(mock_llm_output)}\n```"

    with patch.dict("os.environ", {"OPENAI_API_KEY": "sk-testkey12345678901234567890"}), \
         patch("langchain_openai.ChatOpenAI.invoke", return_value=mock_response):

        state: IncidentState = {
            "incident_id": "INC_LLM_001",
            "failure_type": "SCHEMA_DRIFT",
            "target_table": "raw.customers",
            "raw_error": "Column missing"
        }

        report = generate_root_cause_analysis(state)
        assert report.title == "LLM Diagnosed Schema Drift"
        assert report.confidence_score == 0.97
        assert report.recommended_fix.strategy == "RENAME_COLUMN_ALIAS"
