import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BANNER_CONTENT, type BannerCmsContent } from "@/lib/cms-defaults";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_content")
      .select("content")
      .eq("section_key", "app.banner")
      .maybeSingle();

    if (error || !data?.content || typeof data.content !== "object") {
      return NextResponse.json({ banner: DEFAULT_BANNER_CONTENT });
    }

    const banner: BannerCmsContent = {
      ...DEFAULT_BANNER_CONTENT,
      ...(data.content as Partial<BannerCmsContent>),
    };

    return NextResponse.json({ banner });
  } catch {
    return NextResponse.json({ banner: DEFAULT_BANNER_CONTENT });
  }
}
