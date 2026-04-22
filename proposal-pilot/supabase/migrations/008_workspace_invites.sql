-- ============================================
-- ProposalPilot Migration 008: Workspace Invites
-- Enables owners/admins to add teammates with invite codes.
-- ============================================

alter table public.workspace_members
  add column if not exists member_email text;

create table if not exists public.workspace_invites (
  id uuid primary key default extensions.uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('admin', 'member')),
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_workspace_invites_workspace
  on public.workspace_invites(workspace_id);

create index if not exists idx_workspace_invites_code
  on public.workspace_invites(code);

alter table public.workspace_invites enable row level security;

create or replace function public.is_workspace_admin(ws_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  ) or exists (
    select 1 from public.workspaces
    where id = ws_id and owner_id = auth.uid()
  );
$$ language sql security definer;

drop policy if exists "workspace_members_admin_update" on public.workspace_members;
create policy "workspace_members_admin_update" on public.workspace_members
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create policy "workspace_invites_admin_select" on public.workspace_invites
  for select using (public.is_workspace_admin(workspace_id));

create policy "workspace_invites_admin_insert" on public.workspace_invites
  for insert with check (public.is_workspace_admin(workspace_id));

create policy "workspace_invites_admin_update" on public.workspace_invites
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

create or replace function public.redeem_workspace_invite(invite_code text)
returns table (workspace_id uuid, role text)
language plpgsql
security definer
as $$
declare
  invite public.workspace_invites%rowtype;
  user_email text;
begin
  user_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  select *
  into invite
  from public.workspace_invites
  where code = upper(trim(invite_code))
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if invite.id is null then
    raise exception 'Invite code is invalid or expired';
  end if;

  if invite.email is not null and lower(invite.email) <> user_email then
    raise exception 'Invite code is assigned to a different email address';
  end if;

  if invite.used_by is not null and invite.used_by <> auth.uid() then
    raise exception 'Invite code has already been used';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, member_email)
  values (invite.workspace_id, auth.uid(), invite.role, user_email)
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        member_email = coalesce(public.workspace_members.member_email, excluded.member_email);

  update public.workspace_invites
  set used_by = auth.uid(),
      used_at = coalesce(used_at, now())
  where id = invite.id;

  return query select invite.workspace_id, invite.role;
end;
$$;

grant execute on function public.redeem_workspace_invite(text) to authenticated;

create or replace function public.validate_workspace_invite(
  invite_code text,
  invite_email text
)
returns table (
  is_valid boolean,
  reason text,
  role text,
  workspace_name text
)
language plpgsql
security definer
as $$
declare
  invite public.workspace_invites%rowtype;
  normalized_email text;
begin
  normalized_email := lower(trim(coalesce(invite_email, '')));

  select *
  into invite
  from public.workspace_invites
  where code = upper(trim(invite_code))
    and revoked_at is null
    and expires_at > now()
  limit 1;

  if invite.id is null then
    return query select false, 'Invite code is invalid or expired', null::text, null::text;
    return;
  end if;

  if invite.used_by is not null then
    return query select false, 'Invite code has already been used', null::text, null::text;
    return;
  end if;

  if invite.email is not null and lower(invite.email) <> normalized_email then
    return query select false, 'Invite code is assigned to a different email address', null::text, null::text;
    return;
  end if;

  return query
    select true, null::text, invite.role, w.name
    from public.workspaces w
    where w.id = invite.workspace_id;
end;
$$;

grant execute on function public.validate_workspace_invite(text, text) to anon, authenticated;

create or replace function public.handle_new_user_workspace_invite()
returns trigger
language plpgsql
security definer
as $$
declare
  invite_code text;
  invite public.workspace_invites%rowtype;
  user_email text;
begin
  invite_code := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  user_email := lower(coalesce(new.email, ''));

  if invite_code = '' then
    return new;
  end if;

  select *
  into invite
  from public.workspace_invites
  where code = invite_code
    and revoked_at is null
    and used_by is null
    and expires_at > now()
  limit 1;

  if invite.id is null then
    return new;
  end if;

  if invite.email is not null and lower(invite.email) <> user_email then
    return new;
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, member_email)
  values (invite.workspace_id, new.id, invite.role, user_email)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invites
  set used_by = new.id,
      used_at = coalesce(used_at, now())
  where id = invite.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_workspace_invite on auth.users;
create trigger on_auth_user_workspace_invite
  after insert on auth.users
  for each row execute function public.handle_new_user_workspace_invite();
