import { GoogleGenAI } from "@google/genai";

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return Response.json(
        { error: "GEMINI_API_KEY is missing" },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const response = await ai.models.generateContent({
      model: process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image",
      contents: prompt || "A cinematic street band performing in Paris at sunset",
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.data) {
        return Response.json({
          success: true,
          mimeType: part.inlineData.mimeType,
          imageBase64: part.inlineData.data,
        });
      }
    }

    return Response.json(
      {
        success: false,
        error: "Gemini returned no image",
        response: response,
      },
      { status: 500 }
    );
  } catch (error) {
    console.error("Gemini image test failed:", error);

    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}