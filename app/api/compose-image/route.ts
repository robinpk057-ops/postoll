import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: false,
      error:
        "Image composition is not implemented yet. Use the generated creative directly for now.",
      received: Boolean(body),
    });
  } catch (error) {
    console.error("[Postoll] Compose image error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Invalid compose-image request.",
      },
      {
        status: 400,
      }
    );
  }
}