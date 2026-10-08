# README infographic prompts

Generated with the built-in image_gen tool. The user-provided CloudScale image was used as a visual style reference only.

## dataguardian-workflow.png

Use case: infographic-diagram. Create an English GitHub README infographic for DataGuardian, landscape 16:9, large crisp typography. Match the attached reference's visual style only: white background, monochrome charcoal line icons, pale gray bordered cards, bold black sans-serif headings, generous whitespace, thin arrows; no color, gradients, 3D or decorative robots. Title "DataGuardian: From Broken Pipelines to Reviewed Fixes". Subtitle "A local Agentic DataOps prototype for e-commerce data". Five equal numbered cards left to right with arrows:
1 "DETECT" — icons of table and warning; text "Schema drift", "Missing values", "Duplicate payments"; footer "Quality checks create an incident."
2 "INVESTIGATE" — magnifying glass with three evidence icons; text "Incident logs", "Database schema", "Sample rows & dbt models"; footer "Build an evidence-based diagnosis."
3 "PROPOSE & TEST" — code document above isolated box; text "Generate a SQL model patch", "Check a staging_sandbox view"; footer "Show the code diff and test results."
4 "HUMAN REVIEW" — engineer approval icon and document; text "Review the root cause", "Inspect the proposed fix", "Approve or reject"; footer "An engineer decides whether to apply."
5 "APPLY & RECORD" — file with backup and audit list; text "Back up the dbt model", "Apply the approved patch", "Record the resolution"; footer "Pipeline recovery is simulated."
Bottom full-width strip: "Built with PostgreSQL · dbt · LangGraph · FastAPI · Next.js". Small bottom note "Illustrates the implemented demo workflow; production hardening remains future work." Keep all text accurate and readable, no claims of guaranteed safety or production readiness. Input image 1 is a style reference, not content to copy.

## dataguardian-architecture.png

Use case: infographic-diagram. English GitHub README architecture infographic, landscape 16:9. Same monochrome editorial style as attached reference: white background, charcoal line icons, pale gray card backgrounds, thin borders and arrows, bold readable sans-serif headings, plentiful whitespace, no colors or gradients. Title "DataGuardian: How the Pieces Work Together". Subtitle "Data pipeline + incident investigation + engineer review".
Top horizontal row, three large numbered cards with arrows: "1. LOAD" with CSV document icon and text "E-commerce CSV files" then "PostgreSQL raw tables"; "2. TRANSFORM" with connected tables icon and text "dbt staging views" then "Core models & data tests"; "3. DETECT" with warning icon and text "Quality rules & task failures" then "Incidents in dataops".
From DETECT arrow downward to middle row card "4. INVESTIGATE" with magnifier icon and text "LangGraph workflow" / "Read logs, schema, samples & model code" / "Explain the cause and propose a SQL patch".
Arrow left from investigate to card "5. TEST" with isolated box and code document icon, text "staging_sandbox" / "Create a proposed model view" / "Run model-specific assertions".
Arrow down from TEST to bottom row card "6. REVIEW & APPLY" with human review icon, text "Next.js dashboard + FastAPI" / "Review RCA, code diff & test evidence" / "Approve → back up and patch the model" / "Reject → leave the patch unapplied".
Two small side boxes on right: "AIRFLOW" / "Schedules the data pipeline" / "Records task failures"; and "MCP SERVERS" / "PostgreSQL · dbt · Airflow" / "Diagnostic tools for external AI clients". Make side boxes clearly supporting components, not mandatory additional workflow steps.
Bottom full-width note "Local prototype: in-memory workflow state · shared-database sandbox · pipeline recovery is simulated". Show clearly directed arrows only for specified primary flow. Do not imply the pipeline is automatically rerun or production-ready. Reference image is style reference only.

