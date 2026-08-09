import type { CSSProperties } from "react";

export type FieldTagProps = {
  sampleNo: string;
  timestamp: string;
  title: string;
  description?: string;
  flag: { text: string; state: "flagged" | "verified" };
  rotate?: number;
  delay?: number;
  style?: CSSProperties;
};

export default function FieldTag({ sampleNo, timestamp, title, description, flag, rotate, delay, style }: FieldTagProps) {
  return (
    <div className="fieldTag" style={{ transform: rotate ? `rotate(${rotate}deg)` : undefined, animationDelay: delay ? `${delay}ms` : undefined, ...style }}>
      <div className="fieldTagMeta">{sampleNo} &middot; {timestamp}</div>
      <div className="fieldTagTitle">{title}</div>
      {description && <p className="fieldTagDescription">{description}</p>}
      <span className={`flagChip ${flag.state}`}>{flag.state === "verified" ? "✓" : "⚑"} {flag.text}</span>
    </div>
  );
}
