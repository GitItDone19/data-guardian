import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, GitBranch, Check, Minus, Plus } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import styles from "./landing.module.css";

export const metadata: Metadata = {
  title: "DataGuardian — Understand pipeline failures. Review the fix.",
  description: "An open-source DataOps prototype that brings incident evidence, proposed dbt changes, and sandbox checks into one engineer review workflow.",
};

const github = "https://github.com/GitItDone19/data-guardian";
const steps = [
  ["Detect", "Quality checks or task failures become an incident."],
  ["Investigate", "Inspect logs, source columns, sample rows, and model code."],
  ["Propose", "Explain the cause and prepare a reviewable SQL change."],
  ["Test", "Evaluate a proposed view in the staging_sandbox schema."],
  ["Review", "An engineer examines the evidence and decides what to apply."],
];
const stack = [
  ["PostgreSQL", "The warehouse", "Raw data, transformed models, incident records, and sandbox views."],
  ["dbt", "The transformations", "Staging SQL, core models, and data quality tests."],
  ["LangGraph", "The investigation", "A stateful workflow that gathers evidence and prepares a proposed fix."],
  ["FastAPI + Next.js", "The review surface", "API endpoints and a console for inspecting incidents and changes."],
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">Skip to content</a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="DataGuardian home"><span className={styles.logo} aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19.5h9L9 22l13-10h-9l3-10z" /></svg></span>DataGuardian<span className={styles.wordmarkNote}>/ data reliability</span></Link>
        <nav aria-label="Main navigation" className={styles.nav}>
          <a href="#how-it-works">How it works</a>
          <a href={github}>GitHub <ArrowUpRight size={13} /></a>
          <ThemeToggle />
          <Link className={styles.navCta} href="/dashboard">Open demo <ArrowUpRight size={14} /></Link>
        </nav>
      </header>

      <main id="main">
        <section className={styles.hero}>
          <div className={styles.eyebrow}><span className={styles.dot} />OPEN-SOURCE DATAOPS / LOCAL PROTOTYPE</div>
          <div className={styles.heroGrid}>
            <h1>Understand<br />pipeline failures.<br /><span>Review the fix.</span></h1>
            <div className={styles.heroAside}>
              <p>DataGuardian investigates data issues, proposes dbt model changes, and brings the evidence together for an engineer to review.</p>
              <div className={styles.actions}><Link href="/dashboard" className={styles.primary}>Explore the demo <ArrowRight size={17} /></Link><a href={github} className={styles.textLink}>View on GitHub <ArrowUpRight size={15} /></a></div>
              <p className={styles.heroNote}>Built around an e-commerce warehouse.<br />Designed to make the reasoning visible.</p>
            </div>
          </div>
          <div className={styles.previewHeading}><span><span className={styles.dot} /> AN INCIDENT, WITH CONTEXT</span><span className={styles.demoBadge}>Demo data · illustrative review</span></div>
          <div className={styles.preview}>
            <aside className={styles.incidentSidebar}>
              <div className={styles.mono}>INC_SCHEMA_DRIFT_DEMO</div>
              <h2>A column changed.<br />{" "}A model broke.</h2>
              <span className={styles.reviewBadge}>Awaiting engineer review</span>
              <dl><div><dt>Pipeline</dt><dd>ecommerce_pipeline</dd></div><div><dt>Source</dt><dd>raw.customers</dd></div><div><dt>Affected model</dt><dd>stg_customers</dd></div></dl>
              <div className={styles.evidence}><span className={styles.smallLabel}>OBSERVED CHANGE</span><code>customer_zip_code_prefix</code><ArrowRight size={14} /><code>postal_code_drifted</code></div>
            </aside>
            <div className={styles.reviewPanel}>
              <div className={styles.panelHeader}><span><GitBranch size={15} /> Proposed model change</span><span className={styles.mono}>stg_customers.sql</span></div>
              <p className={styles.diagnosis}>The source column was renamed. The staging model still references its previous name. Update the reference and preserve the output alias.</p>
              <div className={styles.diff} aria-label="Illustrative SQL diff: replace the old source column with postal_code_drifted">
                <div className={styles.codeLine}><span>01</span><code>select</code></div>
                <div className={styles.codeLine}><span>02</span><code>    customer_id,</code></div>
                <div className={`${styles.codeLine} ${styles.removed}`}><Minus size={12} /><code>    customer_zip_code_prefix as zip_code,</code></div>
                <div className={`${styles.codeLine} ${styles.added}`}><Plus size={12} /><code>    postal_code_drifted as zip_code,</code></div>
                <div className={styles.codeLine}><span>04</span><code>    customer_city as city</code></div>
                <div className={styles.codeLine}><span>05</span><code>from raw.customers</code></div>
              </div>
              <div className={styles.previewFooter}><span><Check size={15} /> Example check: expected columns present</span><Link href="/dashboard">Inspect demo incident <ArrowUpRight size={14} /></Link></div>
            </div>
          </div>
          <p className={styles.caption}>01 / A sample review, not a live incident. The hosted demo has no connected backend or database.</p>
        </section>

        <section id="how-it-works" className={styles.workflow}>
          <div className={styles.sectionIntro}><span className={styles.eyebrow}>01 / THE WORKFLOW</span><h2>From a failed check<br />to an informed decision.</h2><p>Automation gathers the context.<br />An engineer keeps the final say.</p></div>
          <ol className={styles.steps}>{steps.map(([name, description], i) => <li key={name}><span className={styles.stepNumber}>0{i + 1}</span><h3>{name}</h3><p>{description}</p>{i < 4 && <ArrowRight size={17} className={styles.stepArrow} aria-hidden="true" />}</li>)}</ol>
        </section>

        <section className={styles.walkthrough} id="walkthrough">
          <div className={styles.caseIntro}><span className={styles.eyebrow}>02 / A CLOSER LOOK</span><h2>Schema drift.<br /><em>Follow the evidence.</em></h2><p>A customer source changes upstream. Here is what an investigation should bring into view before anyone edits the model.</p><a href={`${github}/tree/main/agent`} className={styles.textLink}>Read the investigation code <ArrowUpRight size={15} /></a></div>
          <div className={styles.caseNotes}>
            <article><span>01</span><div><h3>The failure</h3><p>The model expects <code>customer_zip_code_prefix</code>. The source now exposes <code>postal_code_drifted</code>.</p></div></article>
            <article><span>02</span><div><h3>The evidence</h3><p>Compare the actual source columns with the model SQL. Inspect sample rows and downstream dependencies to understand the change.</p></div></article>
            <article><span>03</span><div><h3>The proposed change</h3><p>Reference the renamed field while keeping <code>zip_code</code> as the output name. The diff above illustrates this change; generated proposals still need review.</p></div></article>
            <article><span>04</span><div><h3>The decision</h3><p>Check the sandbox results and the meaning of the renamed field. Approve a suitable patch, or reject it for further investigation.</p></div></article>
          </div>
        </section>

        <section className={styles.architecture} id="architecture">
          <div className={styles.sectionIntro}><span className={styles.eyebrow}>03 / UNDER THE HOOD</span><h2>Familiar tools.<br />One review workflow.</h2><p>The pipeline moves data.<br />DataGuardian explains what went wrong.</p></div>
          <div className={styles.pipeline} aria-label="Data pipeline"><span>CSV sources</span><ArrowRight size={16} /><span>raw</span><ArrowRight size={16} /><span>staging</span><ArrowRight size={16} /><span>core</span><ArrowRight size={16} /><span>dbt tests</span></div>
          <div className={styles.stack}>{stack.map(([name, role, description]) => <article key={name}><h3>{name}</h3><span className={styles.mono}>{role}</span><p>{description}</p></article>)}</div>
          <div className={styles.integrations}><span className={styles.smallLabel}>OPTIONAL CONNECTIONS</span><p><strong>Airflow</strong> schedules ingestion and transformation tasks and records failures. <strong>MCP servers</strong> expose PostgreSQL, dbt, and Airflow diagnostic tools to compatible AI clients.</p></div>
        </section>

        <section className={styles.status} id="project-status">
          <div><span className={styles.eyebrow}>04 / PROJECT STATUS</span><h2>A working prototype.<br />Clear boundaries.</h2><p>Explore the interface online, or run the stack locally to investigate incidents against a real PostgreSQL warehouse.</p><a href={`${github}#quickstart`} className={styles.textLink}>Run it locally <ArrowUpRight size={15} /></a></div>
          <div className={styles.statusNotes}>
            <details open><summary>What is implemented?<Plus size={15} /></summary><p>Quality checks, evidence gathering, RCA, SQL patch proposals, sandbox assertions, and engineer approval or rejection. RCA supports an optional LLM with deterministic fallback.</p></details>
            <details open><summary>What does the hosted demo show?<Plus size={15} /></summary><p>Sample incident data in the browser. No backend or database is connected to this deployment. Demo results do not represent live warehouse checks.</p></details>
            <details><summary>What remains before production use?<Plus size={15} /></summary><p>Pipeline recovery is simulated. Workflow state is held in memory. The sandbox is a schema in the same warehouse. Durable state, stronger validation gates, access controls, and real recovery integration remain future work.</p></details>
          </div>
        </section>
        <section className={styles.closing}><div><span className={styles.eyebrow}>LESS GUESSWORK. MORE CONTEXT.</span><h2>See what goes into a fix.</h2></div><Link href="/dashboard" className={styles.primary}>Explore the demo <ArrowRight size={17} /></Link></section>
      </main>
      <footer className={styles.footer}><Link href="/" className={styles.brand}><span className={styles.logo} aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 19.5h9L9 22l13-10h-9l3-10z" /></svg></span>DataGuardian</Link><span>An open-source data engineering project.</span><div><a href={`${github}#readme`}>Documentation</a><a href={github}>GitHub <ArrowUpRight size={13} /></a></div></footer>
    </div>
  );
}
