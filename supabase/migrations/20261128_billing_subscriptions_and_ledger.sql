-- 1. Extend profiles with billing lifecycle fields
alter table public.profiles
  add column if not exists plan_tier text not null default 'scheduler',
  add column if not exists plan_status text not null default 'active',
  add column if not exists plan_started_at timestamptz,
  add column if not exists plan_ends_at timestamptz,
  add column if not exists stripe_customer_id text;

create index if not exists idx_profiles_stripe_customer_id
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

-- 2. Subscriptions table (current lifecycle state per user/subscription)
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'razorpay', 'system')),
  provider_customer_id text,
  provider_subscription_id text unique,
  provider_price_id text,
  plan_tier text not null check (plan_tier in ('scheduler', 'scheduler_pro', 'creator', 'growth')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  status text not null check (status in ('active', 'past_due', 'canceled', 'expired', 'paused')),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  paused_at timestamptz,
  grace_period_ends_at timestamptz,
  last_payment_at timestamptz,
  billing_address jsonb not null default '{}'::jsonb,
  tax_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_subscriptions_status_period_end
  on public.subscriptions (status, current_period_end);

-- 3. Immutable billing transactions & invoice ledger
create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null check (provider in ('stripe', 'razorpay', 'system')),
  provider_event_id text not null unique,
  provider_invoice_id text,
  provider_payment_intent_id text,
  provider_subscription_id text,
  event_kind text not null check (
    event_kind in (
      'checkout_paid',
      'renewal_paid',
      'upgraded',
      'downgraded',
      'canceled',
      'payment_failed',
      'paused_expired',
      'refunded'
    )
  ),
  plan_tier text not null check (plan_tier in ('scheduler', 'scheduler_pro', 'creator', 'growth')),
  billing_cycle text not null default 'monthly' check (billing_cycle in ('monthly', 'yearly')),
  amount_cents integer not null default 0,
  tax_cents integer not null default 0,
  currency text not null default 'usd',
  status text not null check (status in ('paid', 'failed', 'pending', 'refunded', 'recorded')),
  invoice_number text,
  hosted_invoice_url text,
  invoice_pdf_url text,
  customer_name text,
  customer_email text,
  billing_details jsonb not null default '{}'::jsonb,
  description text,
  period_start timestamptz,
  period_end timestamptz,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_transactions_user_id
  on public.billing_transactions (user_id, occurred_at desc);
create index if not exists idx_billing_transactions_occurred_at
  on public.billing_transactions (occurred_at desc);

-- 4. Row-Level Security (users read own rows; only service_role mutates)
alter table public.subscriptions enable row level security;
alter table public.billing_transactions enable row level security;

drop policy if exists "Users read own subscriptions" on public.subscriptions;
create policy "Users read own subscriptions"
  on public.subscriptions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role manages subscriptions" on public.subscriptions;
create policy "Service role manages subscriptions"
  on public.subscriptions for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "Users read own billing transactions" on public.billing_transactions;
create policy "Users read own billing transactions"
  on public.billing_transactions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Service role manages billing transactions" on public.billing_transactions;
create policy "Service role manages billing transactions"
  on public.billing_transactions for all
  to service_role
  using (true)
  with check (true);

-- 5. Anti-tamper trigger: block authenticated/anon clients from directly modifying plan/billing fields on profiles
create or replace function public.guard_profile_billing_columns()
returns trigger
language plpgsql
as $$
declare
  jwt_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
begin
  if jwt_role <> 'service_role' then
    if new.plan_tier is distinct from old.plan_tier
       or new.plan_status is distinct from old.plan_status
       or new.plan_started_at is distinct from old.plan_started_at
       or new.plan_ends_at is distinct from old.plan_ends_at
       or new.stripe_customer_id is distinct from old.stripe_customer_id then
      raise exception 'Direct modification of plan or billing fields is forbidden';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_profile_billing_columns on public.profiles;
create trigger trg_guard_profile_billing_columns
  before update on public.profiles
  for each row
  execute function public.guard_profile_billing_columns();