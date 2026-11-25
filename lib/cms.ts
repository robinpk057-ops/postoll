import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_BANNER_CONTENT,
  DEFAULT_HERO_CONTENT,
  DEFAULT_STATS_CONTENT,
  type BannerCmsContent,
  type HeroCmsContent,
  type StatCmsItem,
} from "@/lib/cms-defaults";

export {
  DEFAULT_BANNER_CONTENT,
  DEFAULT_HERO_CONTENT,
  DEFAULT_STATS_CONTENT,
  type BannerCmsContent,
  type HeroCmsContent,
  type StatCmsItem,
};

export async function getCmsSections(sectionKeys: string[]) {
  const result = new Map<string, Record<string, unknown>>();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_content")
      .select("section_key, content")
      .in("section_key", sectionKeys);

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (
          row &&
          typeof row.section_key === "string" &&
          row.content &&
          typeof row.content === "object"
        ) {
          result.set(row.section_key, row.content as Record<string, unknown>);
        }
      }
    }
  } catch {
    // Fall back gracefully to defaults if CMS table is unreachable
  }

  return result;
}
