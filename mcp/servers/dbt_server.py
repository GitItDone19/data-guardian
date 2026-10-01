"""
dbt Transformation MCP Server for DataGuardian.
Exposes dbt model, lineage, and schema test inspection capabilities
via the open Model Context Protocol (MCP).
"""

import sys
import os
from typing import Dict, Any

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from mcp.server.mcpserver import MCPServer
from agent.tools.dbt_tools import (
    list_dbt_models,
    read_dbt_model_code,
    read_dbt_schema_contracts,
    get_model_dependencies
)

# Initialize MCP Server instance
server = MCPServer("dataguardian-dbt")


@server.tool(
    name="dbt_list_models",
    description="Lists all dbt SQL models categorized by layer (staging vs. core)."
)
def mcp_list_models() -> Dict[str, Any]:
    """Lists all dbt SQL models categorized by layer."""
    return list_dbt_models()


@server.tool(
    name="dbt_read_model_code",
    description="Reads and returns the raw SQL transformation code of a specific dbt model."
)
def mcp_read_model_code(model_name: str) -> Dict[str, Any]:
    """Reads and returns the raw SQL code of a specific dbt model."""
    return read_dbt_model_code(model_name=model_name)


@server.tool(
    name="dbt_read_schema_contracts",
    description="Parses dbt schema.yml to return all defined columns, tests (not_null, unique), and contracts."
)
def mcp_read_schema_contracts() -> Dict[str, Any]:
    """Parses dbt schema.yml to return all defined columns, tests, and constraints."""
    return read_dbt_schema_contracts()


@server.tool(
    name="dbt_get_model_dependencies",
    description="Extracts upstream dependencies (ref models and sources) from a dbt model's SQL code."
)
def mcp_get_model_dependencies(model_name: str) -> Dict[str, Any]:
    """Extracts upstream references (ref('...') or source('...', '...')) from a model."""
    return get_model_dependencies(model_name=model_name)


def main():
    """Runs the MCP server over standard input/output (stdio)."""
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
