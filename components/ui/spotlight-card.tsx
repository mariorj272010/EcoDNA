"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  glowColor?: "orange" | "green";
  size?: "sm" | "md" | "lg";
  width?: string | number;
  height?: string | number;
  customSize?: boolean;
}

const glowColorMap = { orange: { base: 19, spread: 40 }, green: { base: 145, spread: 40 } };
const sizeMap = { sm: "w-48 h-64", md: "w-64 h-80", lg: "w-80 h-96" };

export function GlowCard({ children, className = "", style, glowColor = "orange", size = "md", width, height, customSize = false }: GlowCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncPointer = (event: PointerEvent) => {
      const card = cardRef.current;
      if (!card) return;
      card.style.setProperty("--x", event.clientX.toFixed(2));
      card.style.setProperty("--xp", (event.clientX / window.innerWidth).toFixed(2));
      card.style.setProperty("--y", event.clientY.toFixed(2));
      card.style.setProperty("--yp", (event.clientY / window.innerHeight).toFixed(2));
    };
    document.addEventListener("pointermove", syncPointer);
    return () => document.removeEventListener("pointermove", syncPointer);
  }, []);

  const { base, spread } = glowColorMap[glowColor];
  const cardStyle = {
    ["--base" as string]: base,
    ["--spread" as string]: spread,
    ["--radius" as string]: "8",
    ["--border" as string]: "2",
    ["--backdrop" as string]: "var(--card-paper)",
    ["--backup-border" as string]: "var(--hairline)",
    ["--size" as string]: "200",
    ["--outer" as string]: "1",
    ["--border-size" as string]: "calc(var(--border, 2) * 1px)",
    ["--spotlight-size" as string]: "calc(var(--size, 150) * 1px)",
    ["--hue" as string]: "calc(var(--base) + (var(--xp, 0) * var(--spread, 0)))",
    backgroundImage: "radial-gradient(var(--spotlight-size) var(--spotlight-size) at calc(var(--x, 0) * 1px) calc(var(--y, 0) * 1px), hsl(var(--hue, 19) calc(var(--saturation, 85) * 1%) calc(var(--lightness, 50) * 1%) / var(--bg-spot-opacity, 0.1)), transparent)",
    backgroundColor: "var(--backdrop, transparent)",
    backgroundSize: "calc(100% + (2 * var(--border-size))) calc(100% + (2 * var(--border-size)))",
    backgroundPosition: "50% 50%",
    backgroundAttachment: "fixed",
    border: "var(--border-size) solid var(--backup-border)",
    position: "relative",
    touchAction: "none",
    width: width === undefined ? undefined : typeof width === "number" ? `${width}px` : width,
    height: height === undefined ? undefined : typeof height === "number" ? `${height}px` : height,
    ...style
  } as CSSProperties;

  return <div ref={cardRef} data-glow style={cardStyle} className={`${customSize ? "" : sizeMap[size]} fieldGlowCard ${className}`}><div data-glow />{children}</div>;
}
