import { NextResponse } from "next/server";

export async function GET() {
  const body = `# Postoll

> AI-powered social media content studio, workflow runner, and automated publishing scheduler.

## Core Capabilities
- Generate social posts, reels, and creative assets with AI workflows
- Schedule recurring time slots across days and timezones
- Manage content libraries, calendars, and connected social accounts

## Key Pages
- Home: https://postoll.vercel.app/
- Sign In: https://postoll.vercel.app/login
- Create Account: https://postoll.vercel.app/signup
- Privacy Policy: https://postoll.vercel.app/privacy
- Data Deletion: https://postoll.vercel.app/data-deletion
`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
