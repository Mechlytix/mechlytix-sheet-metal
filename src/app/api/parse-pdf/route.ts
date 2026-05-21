import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured on the server. Please add it to your .env.local file." },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const base64Data = Buffer.from(bytes).toString("base64");

    // We use gemini-2.5-flash as the default model for multimodal tasks
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const prompt = `You are an expert sheet metal estimator. Analyze this technical drawing PDF and extract the key parameters needed for automated quoting.
Extract the following details:
1. Material name/grade (e.g. Aluminum 5052, Mild Steel, Stainless 304, etc.)
2. Sheet thickness in millimeters (convert gauges to mm if necessary, e.g. 14ga mild steel is ~1.9mm, 11ga is ~3.0mm, 10ga is ~3.4mm, 16ga is ~1.5mm, etc.).
3. Bounding width in millimeters (the largest flat pattern or part width dimension of the unfolded part or overall part bounding box).
4. Bounding height in millimeters (the largest flat vertical dimension of the unfolded part or overall part bounding box).
5. Bend count (total number of bends/folds).
6. Drawing title/number from the title block.
7. Quantity requested if specified.

Be extremely precise. If a value is not explicitly present or cannot be determined with high confidence, set it to null.`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: file.type || "application/pdf",
                  data: base64Data,
                },
              },
              {
                text: prompt,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              material: { type: "STRING" },
              thickness: { type: "NUMBER" },
              boundingWidth: { type: "NUMBER" },
              boundingHeight: { type: "NUMBER" },
              bendCount: { type: "INTEGER" },
              drawingTitle: { type: "STRING" },
              quantity: { type: "INTEGER" },
            },
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Gemini API returned error: ${response.statusText} (${errorText})` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const textResult = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textResult) {
      return NextResponse.json({ error: "No response text received from Gemini API" }, { status: 500 });
    }

    const parsedData = JSON.parse(textResult);
    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Error in parse-pdf API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
