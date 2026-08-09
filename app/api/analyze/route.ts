import { NextRequest, NextResponse } from "next/server";
import { CATEGORIES, MATERIALS, PACKAGING_TYPES } from "@/lib/taxonomy";

export const runtime = "nodejs";

type GeminiCandidate = {
  content?: { parts?: Array<{ text?: string }> };
};

function extractJson(text: string) {
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  return JSON.parse(cleaned);
}

function normalize<T extends readonly string[]>(value: unknown, options: T, fallback: T[number]): T[number] {
  const clean = String(value || "").trim().toLowerCase();
  const exact = options.find(x => x.toLowerCase() === clean);
  if (exact) return exact;

  const aliases: Record<string, string> = {
    "pet": "PET Plastic",
    "pet plastic": "PET Plastic",
    "flexible plastic": "Flexible Plastic",
    "multilayer": "Multilayer Plastic",
    "multi-layer plastic": "Multilayer Plastic",
    "aluminum": "Aluminium",
    "paper": "Paper/Cardboard",
    "cardboard": "Paper/Cardboard",
    "beverages": "Beverage",
    "snacks": "Snack",
    "instant food": "Instant Food",
    "personal care": "Personal Care",
    "bottle": "Bottle",
    "sachet": "Sachet",
    "wrapper": "Wrapper",
    "cup": "Cup",
    "can": "Can",
    "carton": "Carton",
    "bag": "Bag"
  };

  const mapped = aliases[clean];
  return mapped && options.includes(mapped as T[number]) ? mapped as T[number] : fallback;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is missing. Add it to .env.local." },
        { status: 500 }
      );
    }

    const form = await req.formData();
    const file = form.get("image");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No image uploaded." }, { status: 400 });
    }

    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Please upload an image file." }, { status: 400 });
    }

    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Image too large. Keep it under 8 MB." }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const base64 = bytes.toString("base64");

    const prompt = `
You are EcoDNA, an environmental litter classification assistant.

Analyze ONLY clearly visible discarded packaging in the image.

For every visible discarded packaging item return:
- brand: visible brand name, or "Unknown"
- category: MUST be exactly one of:
  Beverage, Snack, Instant Food, Food, Personal Care, Household, Other
- packagingType: MUST be exactly one of:
  Bottle, Sachet, Wrapper, Cup, Can, Carton, Bag, Other
- likelyMaterial: MUST be exactly one of:
  PET Plastic, Flexible Plastic, Multilayer Plastic, HDPE Plastic, PP Plastic,
  Aluminium, Glass, Paper/Cardboard, Unknown
- confidence: number between 0 and 1

Rules:
1. Never guess a brand when unclear.
2. Material is only a visual inference; use Unknown if unsure.
3. If no clear discarded packaging is visible, return {"items":[]}.
4. Return JSON only.
`;

    const endpoint =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const geminiResponse = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: file.type || "image/jpeg", data: base64 } }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json"
        }
      })
    });

    if (!geminiResponse.ok) {
      const detail = await geminiResponse.text();
      return NextResponse.json(
        { error: `Gemini API error (${geminiResponse.status})`, detail },
        { status: 502 }
      );
    }

    const payload = await geminiResponse.json();
    const candidates: GeminiCandidate[] = payload.candidates || [];
    const text = candidates[0]?.content?.parts?.map(p => p.text || "").join("") || "";

    if (!text) {
      return NextResponse.json({ error: "AI returned no text." }, { status: 502 });
    }

    const parsed: unknown = extractJson(text);
    const result = parsed && typeof parsed === "object" ? parsed as { items?: unknown } : {};

    const items = Array.isArray(result.items)
      ? result.items.filter((item): item is Record<string, unknown> => !!item && typeof item === "object").map(item => ({
          brand: String(item.brand || "Unknown").trim().slice(0, 80) || "Unknown",
          category: normalize(item.category, CATEGORIES, "Other"),
          packagingType: normalize(item.packagingType, PACKAGING_TYPES, "Other"),
          likelyMaterial: normalize(item.likelyMaterial, MATERIALS, "Unknown"),
          confidence: Number.isFinite(Number(item.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : 0
        }))
      : [];

    return NextResponse.json({ items });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Unexpected server error." },
      { status: 500 }
    );
  }
}
