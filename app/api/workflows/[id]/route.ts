import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Own workflow only
    const { data: workflow, error: wfError } = await supabase
      .from("workflows")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (wfError || !workflow) {
      return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
    }

    // Delete children first (if no ON DELETE CASCADE)
    await supabase.from("workflow_schedule_runs").delete().eq("workflow_id", id);
    await supabase.from("workflow_schedule_slots").delete().eq("workflow_id", id);
    await supabase.from("workflow_accounts").delete().eq("workflow_id", id);
    await supabase.from("workflow_settings").delete().eq("workflow_id", id);
    await supabase.from("content").delete().eq("workflow_id", id);

    const { error: delError } = await supabase
      .from("workflows")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete workflow error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}