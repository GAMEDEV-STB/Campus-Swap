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
      )
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
  if normalized_email not like '%@bmsce.ac.in'
     and normalized_email not like '%@gmail.com' then
    raise exception 'Sign-up is limited to @bmsce.ac.in or @gmail.com email addresses.';
  end if;

  select exists (
    select 1 from private.admin_email_seeds s where s.email = normalized_email
  ) into seeded_admin;

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
