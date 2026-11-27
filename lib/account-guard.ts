import { SupabaseClient } from '@supabase/supabase-js';
import { getPlanConfig } from './plans';

export type SocialPlatform = 'instagram' | 'tiktok' | 'youtube' | 'facebook' | 'linkedin';

export async function linkAccountToWorkflow(params: {
  supabaseAdmin: SupabaseClient;
  userId: string;
  workflowId: string;
  platform: SocialPlatform;
  platformAccountId: string;
  accountName: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  profileUrl?: string | null;
  profileImageUrl?: string | null;
}): Promise<{ ok: true; accountRowId: string } | { ok: false; errorCode: string }> {
  const { supabaseAdmin, userId, workflowId, platform, platformAccountId } = params;

  const [{ data: profile }, { data: userWorkflows }] = await Promise.all([
    supabaseAdmin.from('profiles').select('plan_tier').eq('id', userId).single(),
    supabaseAdmin
      .from('workflows')
      .select('id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
  ]);

  const plan = getPlanConfig(profile?.plan_tier);
  const allowedWorkflowIds = (userWorkflows ?? []).slice(0, plan.maxWorkflows).map((w) => w.id);

  if (!allowedWorkflowIds.includes(workflowId)) {
    return { ok: false, errorCode: 'upgrade_required_for_second_workflow' };
  }

  const { data: existingAccount } = await supabaseAdmin
    .from('accounts')
    .select('id, user_id')
    .eq('platform', platform)
    .eq('account_id', platformAccountId)
    .maybeSingle();

  if (existingAccount && existingAccount.user_id !== userId) {
    return { ok: false, errorCode: 'channel_already_connected_to_another_user' };
  }

  if (existingAccount) {
    const { data: linkedWorkflow } = await supabaseAdmin
      .from('workflow_accounts')
      .select('workflow_id')
      .eq('account_id', existingAccount.id)
      .maybeSingle();

    if (linkedWorkflow && linkedWorkflow.workflow_id !== workflowId) {
      return { ok: false, errorCode: 'channel_already_used_in_other_workflow' };
    }
  }

  const { data: upsertedAccount, error: accErr } = await supabaseAdmin
    .from('accounts')
    .upsert(
      {
        user_id: userId,
        platform,
        account_id: platformAccountId,
        account_name: params.accountName,
        access_token: params.accessToken,
        refresh_token: params.refreshToken ?? null,
        expires_at: params.expiresAt ?? null,
        connected: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'platform,account_id' }
    )
    .select('id')
    .single();

  if (accErr || !upsertedAccount) {
    return { ok: false, errorCode: 'account_save_failed' };
  }

  await supabaseAdmin.from('social_accounts').upsert(
    {
      user_id: userId,
      platform,
      account_id: platformAccountId,
      account_name: params.accountName,
      profile_url: params.profileUrl ?? null,
      profile_image_url: params.profileImageUrl ?? null,
      status: 'active',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'platform,account_id' }
  );

  const { error: wfErr } = await supabaseAdmin.from('workflow_accounts').upsert(
    {
      workflow_id: workflowId,
      platform,
      account_id: upsertedAccount.id,
    },
    { onConflict: 'workflow_id,platform' }
  );

  if (wfErr) {
    return { ok: false, errorCode: 'workflow_link_failed' };
  }

  return { ok: true, accountRowId: upsertedAccount.id };
}
