"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Scanner from "@/components/Scanner";
import Dashboard from "@/components/Dashboard";
import type { AuthSession, WasteReport } from "@/lib/types";
import { clearReports, loadReports, replaceReports } from "@/lib/storage";
import { seedReports } from "@/lib/seed";
import { APPROVED_REPORT_POINTS } from "@/lib/rewards";

type Tab = "scan" | "dashboard" | "actions" | "rewards";
type AuthMode = "signin" | "register";

const REWARD_TIERS = [
  { name: "Eco Starter", points: 0 },
  { name: "Eco Scout", points: 50 },
  { name: "Waste Guardian", points: 150 },
  { name: "City Champion", points: 300 }
];

function RewardsPanel({ session, reports }: { session: AuthSession; reports: WasteReport[] }) {
  const mine = reports.filter(report => report.reporterId === session.id && report.source !== "demo");
  const approved = mine.filter(report => report.reviewStatus === "approved").length;
  const rejected = mine.filter(report => report.reviewStatus === "rejected").length;
  const pending = mine.length - approved - rejected;
  const currentTier = [...REWARD_TIERS].reverse().find(tier => session.rewardPoints >= tier.points) || REWARD_TIERS[0];
  const nextTier = REWARD_TIERS.find(tier => tier.points > session.rewardPoints);
  const progress = nextTier
    ? Math.round(((session.rewardPoints - currentTier.points) / (nextTier.points - currentTier.points)) * 100)
    : 100;

  return <section className="stack rewardsPage">
    <div className="rewardHero">
      <div><div className="eyebrow">MY ECODNA REWARDS</div><h2>{currentTier.name}</h2><p>@{session.username} earns points only when independent review confirms a submitted litter photograph.</p></div>
      <div className="pointsOrb"><strong>{session.rewardPoints}</strong><span>points</span></div>
    </div>
    <div className="kpis rewardKpis"><div className="kpi"><span>Submitted</span><strong>{mine.length}</strong></div><div className="kpi"><span>Awaiting review</span><strong>{pending}</strong></div><div className="kpi"><span>Approved</span><strong>{approved}</strong></div><div className="kpi"><span>Rejected</span><strong>{rejected}</strong></div></div>
    <div className="card tierCard"><div className="rowBetween"><div><div className="eyebrowDark">BADGE PROGRESS</div><h2>{nextTier ? `${nextTier.points - session.rewardPoints} points to ${nextTier.name}` : "Highest badge reached"}</h2></div><b>{progress}%</b></div><div className="rewardTrack"><div style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div><div className="tierLabels">{REWARD_TIERS.map(tier => <span className={session.rewardPoints >= tier.points ? "earned" : ""} key={tier.name}><b>{tier.name}</b><small>{tier.points} pts</small></span>)}</div></div>
    <div className="grid2"><div className="card"><h3>How points work</h3><ol className="rewardRules"><li>Upload a clear litter photograph with a plausible location.</li><li>Verify Gemini's standardized result before submitting.</li><li>An authorized reviewer checks the evidence and fields.</li><li>An approved report with average AI confidence of at least 80% earns <b>{APPROVED_REPORT_POINTS} points</b>.</li><li>Low-confidence, pending, or rejected reports earn no points.</li></ol></div><div className="card"><h3>Fairness safeguards</h3><p className="muted">Confidence is only an eligibility check, not a bonus. The report must still pass independent review, every reward is linked to one report in Supabase, and reporters cannot approve their own submissions.</p><div className="notice">Points are recognition for this prototype and have no monetary value.</div></div></div>
  </section>;
}

export default function EcoDNAApp() {
  const [tab, setTab] = useState<Tab>("scan");
  const [reports, setReports] = useState<WasteReport[]>([]);
  const [storeStatus, setStoreStatus] = useState("");
  const [session, setSession] = useState<AuthSession | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [showAuth, setShowAuth] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const visibleReports = reports.some(report => report.source === "demo") ? reports : [...reports, ...seedReports];

  async function refresh(silent = false) {
    try {
      setReports(await loadReports());
      setLastUpdated(new Date());
      if (!silent) setStoreStatus("");
    } catch (error: unknown) {
      if (!silent) {
        setReports([]);
        setStoreStatus(error instanceof Error ? error.message : "Could not load observations.");
      }
    }
  }

  async function refreshSession() {
    const response = await fetch("/api/auth/session", { cache: "no-store" });
    if (!response.ok) return setSession(null);
    const payload = await response.json() as { session?: AuthSession };
    setSession(payload.session || null);
  }

  useEffect(() => {
    void refreshSession().then(() => refresh()).finally(() => setCheckingSession(false));
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => { void refresh(true); void refreshSession(); }, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setStoreStatus("Signing in...");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const payload = await response.json() as { error?: string };
    if (!response.ok) return setStoreStatus(payload.error || "Could not sign in.");
    await refreshSession();
    await refresh();
    setPassword("");
    setShowAuth(false);
    setStoreStatus("Signed in successfully.");
  }

  async function register(event: React.FormEvent) {
    event.preventDefault();
    if (password !== passwordConfirmation) return setStoreStatus("Passwords do not match.");
    setStoreStatus("Creating reporter account...");
    const response = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, email, password }) });
    const payload = await response.json() as { error?: string; needsSignIn?: boolean; message?: string };
    if (!response.ok) return setStoreStatus(payload.error || "Could not create the account.");
    if (payload.needsSignIn) {
      setAuthMode("signin");
      setPassword("");
      setPasswordConfirmation("");
      return setStoreStatus(payload.message || "Account created. Sign in to continue.");
    }
    await refreshSession();
    await refresh();
    setPassword("");
    setPasswordConfirmation("");
    setShowAuth(false);
    setStoreStatus("Reporter account created. Welcome to EcoDNA!");
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setSession(null);
    setTab("scan");
    setStoreStatus("Signed out.");
  }

  async function loadDemo() {
    try {
      const fieldReports = reports.filter(report => report.source !== "demo");
      setReports(await replaceReports([...fieldReports, ...seedReports]));
      setStoreStatus("500 Jakarta demo observations loaded; field reports were preserved.");
      setTab("dashboard");
    } catch (error: unknown) {
      setStoreStatus(error instanceof Error ? error.message : "Could not load demo data.");
    }
  }

  async function reset() {
    try {
      setReports(await clearReports());
      setStoreStatus("Observation store cleared. Previously earned rewards were preserved.");
    } catch (error: unknown) {
      setStoreStatus(error instanceof Error ? error.message : "Could not clear observations.");
    }
  }

  const accountForm = !session && showAuth ? <form className="card authCard accountForm" onSubmit={event => void (authMode === "register" ? register(event) : login(event))}>
    <div className="authModeTabs"><button type="button" className={authMode === "signin" ? "active" : ""} onClick={() => setAuthMode("signin")}>Sign in</button><button type="button" className={authMode === "register" ? "active" : ""} onClick={() => setAuthMode("register")}>Create reporter account</button></div>
    <div className="eyebrowDark">{authMode === "register" ? "REPORTER REGISTRATION" : "ECODNA ACCOUNT"}</div>
    <h2>{authMode === "register" ? "Start contributing verified observations" : "Welcome back"}</h2>
    {authMode === "register" && <label>Username<input autoComplete="username" value={username} onChange={event => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} minLength={3} maxLength={24} placeholder="eco_reporter" required /><small>3-24 lowercase letters, numbers, or underscores.</small></label>}
    <label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
    <label>Password<input type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} minLength={8} required /></label>
    {authMode === "register" && <label>Confirm password<input type="password" autoComplete="new-password" value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} minLength={8} required /></label>}
    <button className="primary wide" type="submit">{authMode === "register" ? "Create account" : "Sign in"}</button>
    <p className="muted authHelp">Reporter accounts can submit evidence and earn points. Reviewer permissions are assigned separately by the EcoDNA administrator.</p>
  </form> : null;

  if (checkingSession) return <main><div className="card authCard"><h2>Loading EcoDNA...</h2></div></main>;

  return <main>
    <header className="hero"><div><Link className="backLink" href="/">← EcoDNA overview</Link><div className="eyebrow">AI WASTE INTELLIGENCE</div><h1>EcoDNA</h1><p>Turn litter photos into structured environmental intelligence.</p></div><div className="heroActions">{session ? <><span className="userBadge"><strong>@{session.username}</strong><b>{session.role}{session.role === "reporter" ? ` · ${session.rewardPoints} points` : ""}</b></span>{session.role === "reviewer" && <button onClick={() => void loadDemo()}>Load Demo Data</button>}{session.role === "reviewer" && <button className="ghost" onClick={() => void reset()}>Reset</button>}<button className="ghost" onClick={() => void logout()}>Sign out</button></> : <><button onClick={() => { setAuthMode("signin"); setShowAuth(true); }}>Sign in</button><button className="ghost" onClick={() => { setAuthMode("register"); setShowAuth(true); }}>Create account</button></>}</div></header>
    {storeStatus && <p className="status appStatus">{storeStatus}</p>}
    <div className="syncBar"><span><b>Shared data</b> · auto-refresh every 30 seconds · {lastUpdated ? `last updated ${lastUpdated.toLocaleTimeString()}` : "loading..."}</span><button onClick={() => { void refresh(); void refreshSession(); }}>Refresh now</button></div>
    {accountForm}
    <nav className="tabs" aria-label="EcoDNA tools"><button className={tab === "scan" ? "active" : ""} onClick={() => setTab("scan")}>Scan Waste</button><button className={tab === "dashboard" ? "active" : ""} onClick={() => setTab("dashboard")}>Waste DNA Dashboard</button><button className={tab === "actions" ? "active" : ""} onClick={() => setTab("actions")}>Action Center</button>{session?.role === "reporter" && <button className={tab === "rewards" ? "active" : ""} onClick={() => setTab("rewards")}>My Rewards</button>}</nav>
    {tab === "scan" && (session?.role === "reporter" ? <Scanner onSaved={() => { void refresh(); setTab("rewards"); }} /> : <section className="card scanGate"><div className="eyebrowDark">REPORTER ACCOUNT REQUIRED</div><h2>{session?.role === "reviewer" ? "Reviewer accounts validate submissions" : "Sign in before contributing an observation"}</h2><p className="muted">{session?.role === "reviewer" ? "Sign out and use a reporter account to upload field evidence. Keeping the roles separate prevents reporters from approving their own rewards." : "Accounts connect every submission to a reporter, let reviewers inspect provenance, and award points only after valid evidence is approved."}</p>{!session && <div className="actions"><button className="primary" onClick={() => { setAuthMode("register"); setShowAuth(true); }}>Create reporter account</button><button onClick={() => { setAuthMode("signin"); setShowAuth(true); }}>Sign in</button></div>}</section>)}
    {tab === "dashboard" && <Dashboard reports={visibleReports} canReview={session?.role === "reviewer"} reviewerEmail={session?.email || ""} onReportsChanged={() => void refresh()} />}
    {tab === "actions" && <Dashboard reports={visibleReports} mode="actions" canReview={session?.role === "reviewer"} reviewerEmail={session?.email || ""} onReportsChanged={() => void refresh()} />}
    {tab === "rewards" && session?.role === "reporter" && <RewardsPanel session={session} reports={reports} />}
    <footer>EcoDNA MVP · Visual material classification is an estimate and should be human-verified.</footer>
  </main>;
}
