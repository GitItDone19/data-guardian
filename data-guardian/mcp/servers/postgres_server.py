"""
PostgreSQL MCP Server for DataGuardian.
Exposes read-only schema inspection and safe diagnostic query capabilities
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
from agent.tools.postgres_tools import (
    list_tables,
    describe_table,
    get_table_sample,
    execute_read_query
)

# Initialize MCP Server instance
server = MCPServer("dataguardian-postgres")


@server.tool(
    name="postgres_list_tables",
    description="List all tables present within a specific PostgreSQL schema (e.g. 'raw', 'staging', 'core', 'dataops')."
)
def mcp_list_tables(schema: str = "raw") -> Dict[str, Any]:
    """Lists all tables present within a specific PostgreSQL schema."""
    return list_tables(schema=schema)


@server.tool(
    name="postgres_describe_table",
    description="Returns column names, data types, and nullability constraints for a specific PostgreSQL table."
)
def mcp_describe_table(table_name: str, schema: str = "raw") -> Dict[str, Any]:
    """Returns column names, data types, and nullability constraints for a table."""
    return describe_table(table_name=table_name, schema=schema)


@server.tool(
    name="postgres_get_table_sample",
    description="Fetches a sample of records from a table for empirical inspection (default limit: 5 rows)."
)
def mcp_get_table_sample(table_name: str, schema: str = "raw", limit: int = 5) -> Dict[str, Any]:
    """Fetches a sample of records from a table for empirical inspection."""
    return get_table_sample(table_name=table_name, schema=schema, limit=limit)


@server.tool(
    name="postgres_safe_execute_query",
    description="Safely executes a read-only SELECT query against PostgreSQL with strict guardrails preventing any mutations."
)
def mcp_safe_execute_query(sql_query: str, limit: int = 50) -> Dict[str, Any]:
    """Executes a read-only SELECT query against PostgreSQL with safety guardrails."""
    return execute_read_query(query=sql_query, limit=limit)


def main():
    """Runs the MCP server over standard input/output (stdio)."""
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
