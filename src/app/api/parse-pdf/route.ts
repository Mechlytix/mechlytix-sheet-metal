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

    const prompt = `You are an expert sheet metal estimator. Analyze this technical drawing PDF and extract the key parameters needed for automated quoting.
For each parameter, you must extract:
1. The exact parameter value.
2. The normalized bounding box [ymin, xmin, ymax, xmax] coordinates that tightly enclose only the text characters of that value on the drawing sheet. Coordinates must be integers on a 0-1000 scale representing the full page (where 0,0 is the top-left, and 1000,1000 is the bottom-right).

Parameters to extract:
1. Material name/grade (e.g. Aluminum 5052, Mild Steel, Stainless 304, etc.)
2. Sheet thickness in millimeters (convert gauges to mm if necessary, e.g. 14ga mild steel is ~1.9mm, 11ga is ~3.0mm, 10ga is ~3.4mm, 16ga is ~1.5mm, etc.).
3. Bounding width in millimeters (the largest flat pattern or part width dimension of the unfolded part or overall part bounding box).
4. Bounding height in millimeters (the largest flat vertical dimension of the unfolded part or overall part bounding box).
5. Bend count (total number of bends/folds).
6. Drawing title/number from the title block.
7. Quantity requested if specified.

Also, search the entire drawing (notes, title block, and dimension labels) for any tolerance specifications (e.g. general linear tolerances like 'LINEAR ±0.1mm' or 'TOLERANCES ±0.5', angular tolerances, or tolerances shown inline on specific dimensions like '45.0 ± 0.05'). Return a list of all detected tolerances including their text value, type (linear, angular, geometric, or general), and coordinates box [ymin, xmin, ymax, xmax] that tightly enclose the tolerance callout.

Be extremely precise. If a parameter or value is not explicitly present or cannot be determined with high confidence, set the value to null and box to null.`;

    const requestBody = JSON.stringify({
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
              description: "Extracted drawing title or number from the title block.",
              properties: {
                value: { 
                  type: "STRING", 
                  description: "The title or drawing number string."
                },
                box: { 
                  type: "ARRAY", 
                  items: { type: "INTEGER" },
                  description: "Normalized bounding box [ymin, xmin, ymax, xmax] coordinates enclosing the drawing title text, on a 0-1000 scale."
                }
              }
            },
            material: {
              type: "OBJECT",
              description: "Extracted material specification.",
              properties: {
                value: { 
                  type: "STRING", 
                  description: "The name/grade of the material (e.g., 'Aluminum 5052')."
                },
                box: { 
                  type: "ARRAY", 
                  items: { type: "INTEGER" },
                  description: "Normalized bounding box [ymin, xmin, ymax, xmax] coordinates enclosing the material text, on a 0-1000 scale."
                }
              }
            },
            thickness: {
              type: "OBJECT",
              description: "Extracted sheet thickness.",
              properties: {
                value: { 
                  type: "NUMBER", 
                  description: "Thickness value in millimeters."
                },
                box: { 
                  type: "ARRAY", 
                  items: { type: "INTEGER" },
                  description: "Normalized bounding box [ymin, xmin, ymax, xmax] coordinates enclosing the thickness text or gauge callout, on a 0-1000 scale."
                }
              }
            },
            boundingWidth: {
              type: "OBJECT",
              description: "Extracted part bounding/flat width.",
              properties: {
                value: { 
                  type: "NUMBER", 
                  description: "Width in millimeters."
                },
                box: { 
                  type: "ARRAY", 
                  items: { type: "INTEGER" },
                  description: "Normalized bounding box [ymin, xmin, ymax, xmax] coordinates enclosing the width dimension text, on a 0-1000 scale."
                }
              }
            },
            boundingHeight: {
              type: "OBJECT",
              description: "Extracted part bounding/flat height.",
              properties: {
                value: { 
                  type: "NUMBER", 
                  description: "Height in millimeters."
                },
                box: { 
                  type: "ARRAY", 
                  items: { type: "INTEGER" },
                  description: "Normalized bounding box [ymin, xmin, ymax, xmax] coordinates enclosing the height dimension text, on a 0-1000 scale."
                }
              }
            },
            bendCount: {
              type: "OBJECT",
              description: "Extracted total number of bends.",
              properties: {
                value: { 
                  type: "INTEGER", 
                  description: "Total count of bends/folds."
                },
                box: { 
                  type: "ARRAY", 
                  items: { type: "INTEGER" },
                  description: "Normalized bounding box [ymin, xmin, ymax, xmax] coordinates enclosing the bend count text, bend table, or bend notes, on a 0-1000 scale."
                }
              }
            },
            quantity: {
              type: "OBJECT",
              description: "Extracted quantity requested.",
              properties: {
                value: { 
                  type: "INTEGER", 
                  description: "Quantity value specified on the drawing."
                },
                box: { 
                  type: "ARRAY", 
                  items: { type: "INTEGER" },
                  description: "Normalized bounding box [ymin, xmin, ymax, xmax] coordinates enclosing the quantity text, on a 0-1000 scale."
                }
              }
            },
            tolerances: {
              type: "ARRAY",
              description: "List of tolerances found on the drawing.",
              items: {
                type: "OBJECT",
                properties: {
                  value: { 
                    type: "STRING",
                    description: "The tolerance text callout (e.g. '±0.5mm')."
                  },
                  type: { 
                    type: "STRING",
                    description: "The type of tolerance: 'linear', 'angular', 'geometric', or 'general'."
                  },
                  box: { 
                    type: "ARRAY", 
                    items: { type: "INTEGER" },
                    description: "Normalized bounding box [ymin, xmin, ymax, xmax] coordinates enclosing the tolerance text, on a 0-1000 scale."
                  }
                },
                required: ["value", "type", "box"]
              }
            }
          }
        },
      }
    });

    let model = "gemini-2.5-pro";
    let url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    console.log(`Attempting drawing analysis using ${model}...`);
    let response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`Gemini 2.5 Pro failed: ${response.statusText} (${errorText}). Falling back to Gemini 2.5 Flash...`);
      
      model = "gemini-2.5-flash";
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      console.log(`Attempting drawing analysis using fallback ${model}...`);
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: requestBody,
      });
    }

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
    console.log("Gemini PDF Extracted Data:", JSON.stringify(parsedData, null, 2));
    return NextResponse.json(parsedData);
  } catch (error) {
    console.error("Error in parse-pdf API:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal Server Error" },
      { status: 500 }
    );
  }
}
