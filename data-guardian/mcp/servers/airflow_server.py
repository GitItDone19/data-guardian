"""
Airflow & Incident Diagnostic MCP Server for DataGuardian.
Exposes pipeline health and incident diagnostic capabilities
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
from agent.tools.airflow_tools import (
    get_open_incidents,
    get_incident_details,
    get_pipeline_overview
)

# Initialize MCP Server instance
server = MCPServer("dataguardian-airflow")


@server.tool(
    name="airflow_get_open_incidents",
    description="Fetches all currently OPEN or UNRESOLVED pipeline incidents from dataops.incidents."
)
def mcp_get_open_incidents() -> Dict[str, Any]:
    """Fetches all currently OPEN or UNRESOLVED incidents from dataops.incidents."""
    return get_open_incidents()


@server.tool(
    name="airflow_get_incident_details",
    description="Retrieves full details, error logs, and associated audit events for a specific incident ID."
)
def mcp_get_incident_details(incident_id: str) -> Dict[str, Any]:
    """Retrieves full details, error logs, and associated audit log events for an incident."""
    return get_incident_details(incident_id=incident_id)


@server.tool(
    name="airflow_get_pipeline_overview",
    description="Returns the static structural overview, task list, and schedule of the Airflow pipeline."
)
def mcp_get_pipeline_overview(dag_id: str = "ecommerce_pipeline") -> Dict[str, Any]:
    """Returns the structural overview and tasks of the primary Airflow pipeline."""
    return get_pipeline_overview(dag_id=dag_id)


def main():
    """Runs the MCP server over standard input/output (stdio)."""
    server.run(transport="stdio")


if __name__ == "__main__":
    main()
