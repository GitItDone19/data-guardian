"""
dbt Model & Lineage Inspection Tools for the DataGuardian AI Agent.
Allows the AI Agent to inspect dbt model code, understand data lineage,
and read schema test contracts during Root Cause Analysis (RCA).
"""

import os
import re
import yaml
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DBT_DIR = os.path.join(BASE_DIR, "dbt")
MODELS_DIR = os.path.join(DBT_DIR, "models")


def list_dbt_models() -> Dict[str, Any]:
    """
    Lists all dbt SQL models categorized by layer (staging vs. core).
    """
    if not os.path.exists(MODELS_DIR):
        return {"status": "ERROR", "error": f"dbt models directory not found at {MODELS_DIR}"}

    staging_models = []
    core_models = []

    for root, _, files in os.walk(MODELS_DIR):
        for f in files:
            if f.endswith(".sql"):
                model_name = f.replace(".sql", "")
                rel_path = os.path.relpath(os.path.join(root, f), DBT_DIR)
                if "staging" in rel_path:
                    staging_models.append({"name": model_name, "path": rel_path})
                elif "core" in rel_path:
                    core_models.append({"name": model_name, "path": rel_path})

    return {
        "status": "SUCCESS",
        "total_models": len(staging_models) + len(core_models),
        "staging_models": staging_models,
        "core_models": core_models
    }


def read_dbt_model_code(model_name: str) -> Dict[str, Any]:
    """
    Reads and returns the raw SQL code of a specific dbt model.
    """
    clean_name = model_name.replace(".sql", "").strip()

    target_file = None
    for root, _, files in os.walk(MODELS_DIR):
        for f in files:
            if f == f"{clean_name}.sql":
                target_file = os.path.join(root, f)
                break
        if target_file:
            break

    if not target_file or not os.path.exists(target_file):
        return {"status": "ERROR", "error": f"Model '{clean_name}.sql' not found under {MODELS_DIR}"}

    try:
        with open(target_file, "r", encoding="utf-8") as file:
            code = file.read()
        return {
            "status": "SUCCESS",
            "model_name": clean_name,
            "file_path": os.path.relpath(target_file, BASE_DIR),
            "sql_code": code
        }
    except Exception as e:
        return {"status": "ERROR", "error": f"Failed to read file: {str(e)}"}


def read_dbt_schema_contracts() -> Dict[str, Any]:
    """
    Parses dbt/models/schema.yml to return all defined columns, tests, and constraints.
    """
    schema_path = os.path.join(MODELS_DIR, "schema.yml")
    if not os.path.exists(schema_path):
        return {"status": "ERROR", "error": f"schema.yml not found at {schema_path}"}

    try:
        with open(schema_path, "r", encoding="utf-8") as file:
            data = yaml.safe_load(file)
        return {"status": "SUCCESS", "schema_definitions": data}
    except Exception as e:
        return {"status": "ERROR", "error": f"Failed to parse schema.yml: {str(e)}"}


def get_model_dependencies(model_name: str) -> Dict[str, Any]:
    """
    Extracts upstream references (ref('...') or source('...', '...')) from a model's SQL code.
    """
    code_res = read_dbt_model_code(model_name)
    if code_res["status"] == "ERROR":
        return code_res

    sql = code_res["sql_code"]

    # Match ref('model_name')
    ref_pattern = r"ref\(\s*['\"]([^'\"]+)['\"]\s*\)"
    refs = re.findall(ref_pattern, sql)

    # Match source('source_name', 'table_name')
    source_pattern = r"source\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]\s*\)"
    sources = [f"{s[0]}.{s[1]}" for s in re.findall(source_pattern, sql)]

    return {
        "status": "SUCCESS",
        "model_name": model_name,
        "upstream_models": sorted(list(set(refs))),
        "upstream_sources": sorted(list(set(sources)))
    }
