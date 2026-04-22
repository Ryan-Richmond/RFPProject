-- ============================================
-- ProposalPilot Migration 009: Invite Security Fixes
-- Repairs workspace member update policy and adds invite preflight validation.
-- ============================================

drop policy if exists "workspace_members_admin_update" on public.workspace_members;
create policy "workspace_members_admin_update" on public.workspace_members
  for update using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

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
