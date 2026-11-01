create schema if not exists private;

create table if not exists private.admin_email_seeds (
  email text primary key check (email = lower(email))
);

revoke all on schema private from public, anon, authenticated;
revoke all on private.admin_email_seeds from public, anon, authenticated;

insert into private.admin_email_seeds (email)
values ('souravbs269@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_verified_campus_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and (
        lower(u.email) like '%@bmsce.ac.in'
        or lower(u.email) like '%@gmail.com'
        or exists (
          select 1
          from private.admin_email_seeds s
          where s.email = lower(u.email)
        )
      )
  );
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null default 'Student',
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create or replace function public.is_campus_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'admin'
      and public.is_verified_campus_user()
  );
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(coalesce(new.email, ''));
  seeded_admin boolean;
begin
  select exists (
    select 1 from private.admin_email_seeds s where s.email = normalized_email
  ) into seeded_admin;

  if normalized_email not like '%@bmsce.ac.in'
     and normalized_email not like '%@gmail.com' then
    raise exception 'Sign-up is limited to @bmsce.ac.in or @gmail.com email addresses.';
  end if;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    normalized_email,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Student'),
    case when seeded_admin then 'admin' else 'user' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created_campus_swap
  after insert on auth.users
  for each row execute procedure private.handle_new_auth_user();

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('sell', 'swap', 'donate', 'request')),
  title text not null,
  description text not null default '',
  category text not null,
  price numeric,
  want text not null default '',
  condition text not null default 'good',
  place text not null default '',
  course text not null default '',
  bundle boolean not null default false,
  photos jsonb not null default '[]'::jsonb,
  status text not null default 'active',
  partner_id uuid references public.profiles (id) on delete set null,
  reserved_for uuid references public.profiles (id) on delete set null,
  reserved_until timestamptz,
  swap_with uuid references public.listings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.donation_claims (
  listing_id uuid not null references public.listings (id) on delete cascade,
  claimant_id uuid not null references public.profiles (id) on delete cascade,
  picked boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (listing_id, claimant_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  participant1_id uuid not null references public.profiles (id) on delete cascade,
  participant2_id uuid not null references public.profiles (id) on delete cascade,
  participant1_read_at timestamptz,
  participant2_read_at timestamptz,
  participant1_hidden_at timestamptz,
  participant2_hidden_at timestamptz,
  participant1_cleared_at timestamptz,
  participant2_cleared_at timestamptz,
  created_at timestamptz not null default now(),
  check (participant1_id <> participant2_id)
);

create unique index conversations_listing_participants_unique
  on public.conversations (
    listing_id,
    least(participant1_id, participant2_id),
    greatest(participant1_id, participant2_id)
  );

create or replace function public.is_conversation_participant(conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversations c
    where c.id = conversation_id
      and (c.participant1_id = (select auth.uid()) or c.participant2_id = (select auth.uid()))
  );
$$;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null default '',
  payload jsonb not null default '{}'::jsonb,
  deleted_for uuid[] not null default '{}',
  deleted_for_everyone boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  stars integer not null check (stars between 1 and 5),
  text text not null default '',
  created_at timestamptz not null default now(),
  check (reviewer_id <> reviewee_id),
  unique (listing_id, reviewer_id, reviewee_id)
);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('listing', 'user', 'chat')),
  target_id uuid not null,
  target_label text not null default '',
  reason text not null,
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed', 'removed')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.donation_claims enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.ratings enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

revoke all on public.profiles, public.listings, public.conversations,
  public.messages, public.ratings, public.blocks, public.reports, public.donation_claims
  from anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.listings to authenticated;
grant select, insert on public.donation_claims to authenticated;
grant update (picked) on public.donation_claims to authenticated;
grant select, insert on public.conversations to authenticated;
grant update (
  participant1_read_at,
  participant2_read_at,
  participant1_hidden_at,
  participant2_hidden_at,
  participant1_cleared_at,
  participant2_cleared_at
) on public.conversations to authenticated;
grant select, insert, delete on public.messages to authenticated;
grant update (text, payload, deleted_for, deleted_for_everyone) on public.messages to authenticated;
grant select, insert on public.ratings to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant select, insert, update on public.reports to authenticated;
revoke all on function public.is_verified_campus_user() from public, anon;
revoke all on function public.is_campus_admin() from public, anon;
revoke all on function public.is_conversation_participant(uuid) from public, anon;
grant execute on function public.is_verified_campus_user() to authenticated;
grant execute on function public.is_campus_admin() to authenticated;
grant execute on function public.is_conversation_participant(uuid) to authenticated;

create policy "verified users read profiles"
  on public.profiles for select to authenticated
  using (public.is_verified_campus_user());

create policy "verified users read listings"
  on public.listings for select to authenticated
  using (public.is_verified_campus_user());
create policy "verified users create their listings"
  on public.listings for insert to authenticated
  with check (public.is_verified_campus_user() and owner_id = (select auth.uid()));
create policy "owners update listings"
  on public.listings for update to authenticated
  using (public.is_verified_campus_user() and owner_id = (select auth.uid()))
  with check (public.is_verified_campus_user() and owner_id = (select auth.uid()));
create policy "owners or admins delete listings"
  on public.listings for delete to authenticated
  using (
    public.is_verified_campus_user()
    and (owner_id = (select auth.uid()) or public.is_campus_admin())
  );

create policy "listing owners and claimants read donation claims"
  on public.donation_claims for select to authenticated
  using (
    public.is_verified_campus_user()
    and (
      claimant_id = (select auth.uid())
      or exists (
        select 1 from public.listings l
        where l.id = listing_id and l.owner_id = (select auth.uid())
      )
    )
  );
create policy "verified users claim available donations"
  on public.donation_claims for insert to authenticated
  with check (
    public.is_verified_campus_user()
    and claimant_id = (select auth.uid())
    and exists (
      select 1 from public.listings l
      where l.id = listing_id
        and l.type = 'donate'
        and l.status <> 'done'
        and l.owner_id <> (select auth.uid())
    )
  );
create policy "listing owners choose donation claimants"
  on public.donation_claims for update to authenticated
  using (
    public.is_verified_campus_user()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  )
  with check (
    public.is_verified_campus_user()
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  );

create policy "participants read conversations"
  on public.conversations for select to authenticated
  using (
    public.is_verified_campus_user()
    and (participant1_id = (select auth.uid()) or participant2_id = (select auth.uid()))
  );
create policy "participants create conversations"
  on public.conversations for insert to authenticated
  with check (
    public.is_verified_campus_user()
    and (participant1_id = (select auth.uid()) or participant2_id = (select auth.uid()))
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and (l.owner_id = participant1_id or l.owner_id = participant2_id)
    )
  );
create policy "participants update conversation state"
  on public.conversations for update to authenticated
  using (
    public.is_verified_campus_user()
    and (participant1_id = (select auth.uid()) or participant2_id = (select auth.uid()))
  )
  with check (
    public.is_verified_campus_user()
    and (participant1_id = (select auth.uid()) or participant2_id = (select auth.uid()))
  );

create policy "participants read messages"
  on public.messages for select to authenticated
  using (public.is_verified_campus_user() and public.is_conversation_participant(conversation_id));
create policy "participants send messages as themselves"
  on public.messages for insert to authenticated
  with check (
    public.is_verified_campus_user()
    and sender_id = (select auth.uid())
    and public.is_conversation_participant(conversation_id)
  );
create policy "participants update messages"
  on public.messages for update to authenticated
  using (
    public.is_verified_campus_user()
    and public.is_conversation_participant(conversation_id)
  )
  with check (
    public.is_verified_campus_user()
    and public.is_conversation_participant(conversation_id)
  );
create policy "senders delete their messages"
  on public.messages for delete to authenticated
  using (
    public.is_verified_campus_user()
    and sender_id = (select auth.uid())
    and public.is_conversation_participant(conversation_id)
  );

create policy "verified users read ratings"
  on public.ratings for select to authenticated
  using (public.is_verified_campus_user());
create policy "participants rate completed exchanges"
  on public.ratings for insert to authenticated
  with check (
    public.is_verified_campus_user()
    and reviewer_id = (select auth.uid())
    and exists (
      select 1
      from public.listings l
      where l.id = listing_id
        and l.status = 'done'
        and reviewer_id <> reviewee_id
        and exists (
          select 1
          from public.conversations c
          where c.listing_id = l.id
            and (
              (c.participant1_id = reviewer_id and c.participant2_id = reviewee_id)
              or (c.participant2_id = reviewer_id and c.participant1_id = reviewee_id)
            )
        )
    )
  );

create policy "users read their own blocks"
  on public.blocks for select to authenticated
  using (public.is_verified_campus_user() and blocker_id = (select auth.uid()));
create policy "users create their own blocks"
  on public.blocks for insert to authenticated
  with check (
    public.is_verified_campus_user()
    and blocker_id = (select auth.uid())
    and blocker_id <> blocked_id
  );
create policy "users remove their own blocks"
  on public.blocks for delete to authenticated
  using (public.is_verified_campus_user() and blocker_id = (select auth.uid()));

create policy "verified users submit own reports"
  on public.reports for insert to authenticated
  with check (
    public.is_verified_campus_user()
    and reporter_id = (select auth.uid())
    and status = 'open'
  );
create policy "admins read reports"
  on public.reports for select to authenticated
  using (public.is_campus_admin());
create policy "admins resolve reports"
  on public.reports for update to authenticated
  using (public.is_campus_admin())
  with check (public.is_campus_admin());

update public.profiles p
set role = 'admin'
from private.admin_email_seeds s
where lower(p.email) = s.email;
