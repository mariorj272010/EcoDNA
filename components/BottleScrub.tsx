"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const FRAME_COUNT = 300;
const FRAME_SRC = (i: number) => `/bottle/frame-${String(i + 1).padStart(3, "0")}.webp`;

export default function BottleScrub() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let images: HTMLImageElement[] = [];
    let loadedCount = 0;
    let raf = 0;
    let currentProgress = 0;
    let trigger: ScrollTrigger | null = null;

    const draw = (progress: number) => {
      if (loadedCount < FRAME_COUNT) return;
      const index = Math.min(FRAME_COUNT - 1, Math.round(progress * (FRAME_COUNT - 1)));
      const img = images[index];
      if (!img || !img.complete) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = canvas.getBoundingClientRect();
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const scale = Math.min(width / img.width, height / img.height);
      const w = img.width * scale;
      const h = img.height * scale;

      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
    };

    images = Array.from({ length: FRAME_COUNT }, (_, i) => {
      const img = new Image();
      img.onload = () => {
        loadedCount++;
        if (loadedCount === FRAME_COUNT) draw(currentProgress);
      };
      img.src = FRAME_SRC(i);
      return img;
    });

    trigger = ScrollTrigger.create({
      trigger: canvas.closest(".landingIntro") as HTMLElement,
      start: "top top",
      end: "+=3000",
      pin: true,
      scrub: true,
      onUpdate: self => {
        currentProgress = self.progress;
        if (!raf) raf = requestAnimationFrame(() => { draw(currentProgress); raf = 0; });
      }
    });

    const onResize = () => draw(currentProgress);
    window.addEventListener("resize", onResize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      trigger?.kill();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="bottleCanvas" aria-hidden="true" />;
}
