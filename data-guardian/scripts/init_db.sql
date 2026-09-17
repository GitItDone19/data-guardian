-- Create Data Engineering Warehouse Schemas
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Create Isolated Staging Sandbox Schema for Agent Fix Testing
CREATE SCHEMA IF NOT EXISTS staging_sandbox;

-- Create Operations Audit Schema for Agent Incidents & History
CREATE SCHEMA IF NOT EXISTS dataops;

-- Grant permissions to the data_guardian user
GRANT ALL PRIVILEGES ON SCHEMA raw TO data_guardian;
GRANT ALL PRIVILEGES ON SCHEMA staging TO data_guardian;
GRANT ALL PRIVILEGES ON SCHEMA core TO data_guardian;
GRANT ALL PRIVILEGES ON SCHEMA analytics TO data_guardian;
GRANT ALL PRIVILEGES ON SCHEMA staging_sandbox TO data_guardian;
GRANT ALL PRIVILEGES ON SCHEMA dataops TO data_guardian;

-- Create Incident Tracker Table in dataops schema
CREATE TABLE IF NOT EXISTS dataops.incidents (
    incident_id VARCHAR(50) PRIMARY KEY,
    pipeline_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_summary TEXT,
    root_cause TEXT,
    impact_analysis TEXT,
    proposed_fix TEXT,
    test_results TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create Agent Audit Log Table
CREATE TABLE IF NOT EXISTS dataops.agent_audit_log (
    log_id SERIAL PRIMARY KEY,
    incident_id VARCHAR(50) REFERENCES dataops.incidents(incident_id),
    action_type VARCHAR(100) NOT NULL,
    tool_name VARCHAR(100),
    tool_input JSONB,
    tool_output JSONB,
    reasoning_summary TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
