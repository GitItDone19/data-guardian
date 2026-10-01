"""
CLI Runner for DataGuardian Data Quality & Anomaly Detection Engine.
Can be executed standalone:
    python scripts/run_quality_checks.py
    python scripts/run_quality_checks.py --table raw.orders
    python scripts/run_quality_checks.py --type null_rate
    python scripts/run_quality_checks.py --dry-run
"""

import os
import sys
import argparse

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BACKEND_DIR = os.path.join(BASE_DIR, "backend", "services")

for p in [BASE_DIR, BACKEND_DIR]:
    if p not in sys.path:
        sys.path.append(p)

from backend.services.quality_engine import QualityEngine
from backend.services.quality_rules import DEFAULT_QUALITY_RULES, QualityRule


def main():
    parser = argparse.ArgumentParser(description="DataGuardian Data Quality & Anomaly Detection Runner")
    parser.add_argument("--table", type=str, default=None, help="Filter checks by specific table (e.g., 'raw.orders')")
    parser.add_argument("--type", type=str, default=None, help="Filter checks by rule type (e.g., 'null_rate', 'volume_bounds')")
    parser.add_argument("--dry-run", action="store_true", help="Run checks without emitting incidents to dataops.incidents")
    args = parser.parse_args()

    # Filter rules based on arguments
    rules_to_run = DEFAULT_QUALITY_RULES
    if args.table:
        rules_to_run = [r for r in rules_to_run if r.table_name.lower() == args.table.lower()]
    if args.type:
        rules_to_run = [r for r in rules_to_run if r.rule_type.lower() == args.type.lower()]

    print("=" * 80)
    print(" DATAGUARDIAN DATA QUALITY & ANOMALY DETECTION SUITE")
    print("=" * 80)
    print(f"Target Rules to Evaluate: {len(rules_to_run)}")
    if args.table:
        print(f"Filter Table: {args.table}")
    if args.type:
        print(f"Filter Rule Type: {args.type}")
    print(f"Emit Incidents: {'DISABLED (Dry Run)' if args.dry_run else 'ENABLED'}")
    print("-" * 80)

    engine = QualityEngine()
    summary = engine.run_checks(rules=rules_to_run, emit_on_failure=not args.dry_run)

    print("\nRESULTS BREAKDOWN:")
    print("-" * 80)
    for res in summary["results"]:
        status_tag = f"[{res.status}]"
        if res.status == "PASSED":
            status_display = f"\033[92m{status_tag}\033[0m" if sys.stdout.isatty() else status_tag
        elif res.status == "FAILED":
            status_display = f"\033[91m{status_tag}\033[0m" if sys.stdout.isatty() else status_tag
        else:
            status_display = f"\033[93m{status_tag}\033[0m" if sys.stdout.isatty() else status_tag

        print(f"{status_display:<10} Rule: {res.rule.rule_id:<25} Table: {res.rule.table_name}")
        print(f"           Description: {res.rule.description}")
        print(f"           Expected:    {res.expected_threshold}")
        print(f"           Actual:      {res.actual_value}")
        if res.status == "FAILED" and res.incident_id:
            print(f"           🚨 Incident Registered: {res.incident_id}")
        if res.status in ["FAILED", "ERROR"]:
            print(f"           Detail: {res.message}")
        print("-" * 80)

    print("\n" + "=" * 80)
    print("EXECUTION SUMMARY:")
    print(f"Total Rules Evaluated: {summary['total_rules']}")
    print(f"  Passed:  {summary['passed']}")
    print(f"  Failed:  {summary['failed']}")
    print(f"  Errors:  {summary['errors']}")
    print("=" * 80)

    if summary["failed"] > 0 or summary["errors"] > 0:
        print("\n[ALERT] Data quality violations detected! Incidents have been logged for Agent RCA.\n")
        sys.exit(1)
    else:
        print("\n[SUCCESS] All warehouse data quality and metric thresholds are healthy.\n")
        sys.exit(0)


if __name__ == "__main__":
    main()
