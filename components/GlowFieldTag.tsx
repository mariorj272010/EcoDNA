import { GlowCard } from "@/components/ui/spotlight-card";
import type { FieldTagProps } from "@/components/FieldTag";

export default function GlowFieldTag({ sampleNo, timestamp, title, description, flag, rotate, delay, style }: FieldTagProps) {
  return (
    <GlowCard customSize glowColor={flag.state === "verified" ? "green" : "orange"} className="fieldTag" style={{ position: "absolute", transform: rotate ? `rotate(${rotate}deg)` : undefined, animationDelay: delay ? `${delay}ms` : undefined, ...style }}>
      <div>
        <div className="fieldTagMeta">{sampleNo} &middot; {timestamp}</div>
        <div className="fieldTagTitle">{title}</div>
        {description && <p className="fieldTagDescription">{description}</p>}
      </div>
      <span className={`flagChip ${flag.state}`}>{flag.state === "verified" ? "✓" : "⚑"} {flag.text}</span>
    </GlowCard>
  );
}
