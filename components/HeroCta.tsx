"use client";

import { useRouter } from "next/navigation";
import { ShinyButton } from "@/components/ui/shiny-button";

export default function HeroCta() {
  const router = useRouter();
  return <ShinyButton onClick={() => router.push("/app")}>Start logging your block &rarr;</ShinyButton>;
}
