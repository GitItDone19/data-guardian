"""
Quality Rules Catalog for DataGuardian.
Defines statistical threshold assertions, schema contracts, and volume expectations
for tables across the raw, staging, and core schemas.
"""

from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List


@dataclass
class QualityRule:
    rule_id: str
    table_name: str          # e.g., 'raw.orders'
    rule_type: str           # 'null_rate', 'volume_bounds', 'duplicate_rate', 'value_range', 'schema_drift'
    description: str
    column_name: Optional[str] = None
    params: Dict[str, Any] = field(default_factory=dict)
    severity: str = "CRITICAL"  # 'CRITICAL' or 'WARNING'


# Default Production Quality Assertion Catalog
DEFAULT_QUALITY_RULES: List[QualityRule] = [
    # --- raw.customers Checks ---
    QualityRule(
        rule_id="QR_CUST_SCHEMA_DRIFT",
        table_name="raw.customers",
        rule_type="schema_drift",
        description="Verify expected columns exist in raw.customers to guard against upstream schema drift.",
        params={"required_columns": [
            "customer_id",
            "customer_unique_id",
            "customer_zip_code_prefix",
            "customer_city",
            "customer_state"
        ]},
        severity="CRITICAL"
    ),
    QualityRule(
        rule_id="QR_CUST_NULL_ID",
        table_name="raw.customers",
        rule_type="null_rate",
        column_name="customer_id",
        description="Customer ID must not contain null values (null rate <= 0.0%).",
        params={"max_null_rate": 0.0},
        severity="CRITICAL"
    ),
    QualityRule(
        rule_id="QR_CUST_DUP_ID",
        table_name="raw.customers",
        rule_type="duplicate_rate",
        column_name="customer_id",
        description="Customer ID must be completely unique (duplicate rate == 0.0%).",
        params={"max_duplicate_rate": 0.0},
        severity="CRITICAL"
    ),

    # --- raw.orders Checks ---
    QualityRule(
        rule_id="QR_ORDERS_VOLUME",
        table_name="raw.orders",
        rule_type="volume_bounds",
        description="Row count in raw.orders must fall within normal expected daily bounds [4,000, 6,000].",
        params={"min_rows": 4000, "max_rows": 6000},
        severity="WARNING"
    ),
    QualityRule(
        rule_id="QR_ORDERS_NULL_STATUS",
        table_name="raw.orders",
        rule_type="null_rate",
        column_name="order_status",
        description="Order status must have less than 2.0% null rate under normal operation.",
        params={"max_null_rate": 0.02},
        severity="CRITICAL"
    ),
    QualityRule(
        rule_id="QR_ORDERS_DUP_ID",
        table_name="raw.orders",
        rule_type="duplicate_rate",
        column_name="order_id",
        description="Order ID must be strictly unique (duplicate rate == 0.0%).",
        params={"max_duplicate_rate": 0.0},
        severity="CRITICAL"
    ),

    # --- raw.payments Checks ---
    QualityRule(
        rule_id="QR_PAYMENTS_NON_NEGATIVE",
        table_name="raw.payments",
        rule_type="value_range",
        column_name="payment_value",
        description="Payment values cannot be negative (min_value >= 0.0).",
        params={"min_value": 0.0},
        severity="CRITICAL"
    ),
    QualityRule(
        rule_id="QR_PAYMENTS_DUP_TRANSACTION",
        table_name="raw.payments",
        rule_type="duplicate_rate",
        column_name="order_id, payment_sequential",
        description="Payment transactions (order_id + payment_sequential) must have zero duplicate rate.",
        params={"max_duplicate_rate": 0.0},
        severity="CRITICAL"
    ),
]
