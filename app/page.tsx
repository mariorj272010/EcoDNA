import Link from "next/link";
import FieldTag from "@/components/FieldTag";
import GlowFieldTag from "@/components/GlowFieldTag";
import HeroCta from "@/components/HeroCta";
import BottleScrub from "@/components/BottleScrub";
import { seedReports } from "@/lib/seed";

const HOW_IT_WORKS = [
  {
    sampleNo: "STEP 01",
    timestamp: "Capture",
    title: "Photograph it",
    description: "Spot discarded packaging on your street? Photograph it with your phone.",
    flag: { text: "In progress", state: "flagged" as const }
  },
  {
    sampleNo: "STEP 02",
    timestamp: "Verify",
    title: "Confirm the read",
    description: "AI proposes what it sees. You confirm or correct it — you're the record of truth.",
    flag: { text: "In progress", state: "flagged" as const }
  },
  {
    sampleNo: "STEP 03",
    timestamp: "Map",
    title: "Join the log",
    description: "Your report joins the block's growing, location-tagged record.",
    flag: { text: "Verified", state: "verified" as const }
  }
];

export default function LandingPage() {
  const recentLog = seedReports.flatMap(report =>
    report.items.map(item => ({
      sampleNo: report.id.replace("seed-", "Sample 0"),
      timestamp: new Date(report.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      title: item.likelyMaterial,
      flag: item.likelyMaterial === "Unknown"
        ? { text: item.packagingType, state: "flagged" as const }
        : { text: "Verified", state: "verified" as const }
    }))
  ).slice(0, 6);

  return (
    <main className="originalLanding">
      <section className="landingIntro">
        <BottleScrub />
      </section>

      <section className="landingHero">
        <div>
          <div className="eyebrow">Sample No. 0184 &middot; Logged today, 6:12 PM</div>
          <h1 className="landingHeroHeadline">Turn your street<br />into a <em>record.</em></h1>
          <p className="landingHeroBody">Every piece of litter you scan becomes a logged, verified observation &mdash; building your block&apos;s first real waste record.</p>
          <HeroCta />
        </div>
        <div className="landingTagStack">
          <GlowFieldTag sampleNo="Sample 0182" timestamp="Yesterday" title="Aluminium can" flag={{ text: "Verified", state: "verified" }} rotate={-4} delay={0} style={{ top: 0, left: "10%", zIndex: 3 }} />
          <GlowFieldTag sampleNo="Sample 0183" timestamp="Yesterday" title="Wrapper" flag={{ text: "Flexible plastic", state: "flagged" }} rotate={3} delay={90} style={{ top: 60, left: "28%", zIndex: 2, opacity: .88 }} />
          <GlowFieldTag sampleNo="Sample 0184" timestamp="Today" title="PET bottle" flag={{ text: "Verified", state: "verified" }} rotate={-2} delay={180} style={{ top: 120, left: "6%", zIndex: 1, opacity: .68 }} />
        </div>
      </section>

      <section className="landingSection">
        <h2 className="landingSectionHeadline">How a report gets logged</h2>
        <div className="landingSteps">
          {HOW_IT_WORKS.map((step, i) => (
            <FieldTag key={step.title} {...step} delay={i * 90} />
          ))}
        </div>
      </section>

      <section className="landingSection">
        <h2 className="landingSectionHeadline">Recent field log</h2>
        <p className="muted" style={{ marginTop: "-14px", marginBottom: 20 }}>Sample data for demo &mdash; your neighborhood&apos;s real log starts when you scan.</p>
        <div className="landingLogGrid">
          {recentLog.map((entry, i) => (
            <FieldTag key={`${entry.sampleNo}-${entry.title}-${i}`} {...entry} delay={i * 60} />
          ))}
        </div>
      </section>

      <section className="landingSection landingCaseFile">
        <h2 className="landingSectionHeadline">Why it matters</h2>
        <p>Waste hotspots are often known without reliable composition data &mdash; a block might be known as &quot;dirty&quot; without anyone knowing whether the real problem is bottles, sachets, wrappers, or cans. Generic cleanup effort wastes limited resources on the wrong fix.</p>
        <p>EcoDNA closes that loop, one logged observation at a time:</p>
        <div className="landingLoop">
          <span>Observe</span>
          <span>Diagnose</span>
          <span>Prioritize</span>
          <span>Intervene</span>
          <span>Measure</span>
        </div>
      </section>

      <section className="landingCta">
        <div className="landingStamp">&#10003; Verified by residents</div>
        <h2 className="landingSectionHeadline" style={{ borderTop: "none" }}>Join the survey</h2>
        <Link href="/app" className="primary">Start logging your block &rarr;</Link>
      </section>

      <footer>
        EcoDNA &bull; Visual material classification is an estimate and should be human-verified.
      </footer>
    </main>
  );
}
