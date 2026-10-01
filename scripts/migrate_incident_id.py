from backend.services.quality_engine import get_engine
from sqlalchemy import text

def alter_schema():
    engine = get_engine()
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE dataops.incidents ALTER COLUMN incident_id TYPE VARCHAR(150);"))
        conn.execute(text("ALTER TABLE dataops.agent_audit_log ALTER COLUMN incident_id TYPE VARCHAR(150);"))
    print("MIGRATION_SUCCESSFUL")

if __name__ == "__main__":
    alter_schema()
