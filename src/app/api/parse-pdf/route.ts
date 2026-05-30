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
For each parameter, extract:
1. The parameter value.
2. The normalized bounding box [ymin, xmin, ymax, xmax] coordinates where this value was found on the drawing sheet. Coordinates must be integers on a 0-1000 scale representing the full page (where 0,0 is the top-left, and 1000,1000 is the bottom-right).

Parameters to extract:
1. Material name/grade (e.g. Aluminum 5052, Mild Steel, Stainless 304, etc.)
2. Sheet thickness in millimeters (convert gauges to mm if necessary, e.g. 14ga mild steel is ~1.9mm, 11ga is ~3.0mm, 10ga is ~3.4mm, 16ga is ~1.5mm, etc.).
3. Bounding width in millimeters (the largest flat pattern or part width dimension of the unfolded part or overall part bounding box).
4. Bounding height in millimeters (the largest flat vertical dimension of the unfolded part or overall part bounding box).
5. Bend count (total number of bends/folds).
6. Drawing title/number from the title block.
7. Quantity requested if specified.

Also, search the entire drawing (notes, title block, and dimension labels) for any tolerance specifications (e.g. general linear tolerances like 'LINEAR ±0.1mm' or 'TOLERANCES ±0.5', angular tolerances, or tolerances shown inline on specific dimensions like '45.0 ± 0.05'). Return a list of all detected tolerances including their text value, type (linear, angular, geometric, or general), and coordinates box [ymin, xmin, ymax, xmax].

Be extremely precise. If a parameter or value is not explicitly present or cannot be determined with high confidence, set the value to null and box to null.`;

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
              drawingTitle: {
                type: "OBJECT",
                properties: {
                  value: { type: "STRING" },
                  box: { type: "ARRAY", items: { type: "INTEGER" } }
                }
              },
              material: {
                type: "OBJECT",
                properties: {
                  value: { type: "STRING" },
                  box: { type: "ARRAY", items: { type: "INTEGER" } }
                }
              },
              thickness: {
                type: "OBJECT",
                properties: {
                  value: { type: "NUMBER" },
                  box: { type: "ARRAY", items: { type: "INTEGER" } }
                }
              },
              boundingWidth: {
                type: "OBJECT",
                properties: {
                  value: { type: "NUMBER" },
                  box: { type: "ARRAY", items: { type: "INTEGER" } }
                }
              },
              boundingHeight: {
                type: "OBJECT",
                properties: {
                  value: { type: "NUMBER" },
                  box: { type: "ARRAY", items: { type: "INTEGER" } }
                }
              },
              bendCount: {
                type: "OBJECT",
                properties: {
                  value: { type: "INTEGER" },
                  box: { type: "ARRAY", items: { type: "INTEGER" } }
                }
              },
              quantity: {
                type: "OBJECT",
                properties: {
                  value: { type: "INTEGER" },
                  box: { type: "ARRAY", items: { type: "INTEGER" } }
                }
              },
              tolerances: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    value: { type: "STRING" },
                    type: { type: "STRING" },
                    box: { type: "ARRAY", items: { type: "INTEGER" } }
                  },
                  required: ["value", "type", "box"]
                }
              }
            }
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
