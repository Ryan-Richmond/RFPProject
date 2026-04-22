-- ============================================
-- ProposalPilot Migration 007: Document Storage
-- Creates the private Supabase Storage bucket used for uploaded RFPs
-- and company documents.
-- ============================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'documents',
  'documents',
  false,
  52428800,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_object_workspace_id(object_name text)
returns uuid
language plpgsql
stable
as $$
declare
  first_folder text;
begin
  first_folder := (storage.foldername(object_name))[1];
  return first_folder::uuid;
exception
  when others then
    return null;
end;
$$;

drop policy if exists "documents_select" on storage.objects;
drop policy if exists "documents_insert" on storage.objects;
drop policy if exists "documents_update" on storage.objects;
drop policy if exists "documents_delete" on storage.objects;

create policy "documents_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "documents_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "documents_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  )
  with check (
    bucket_id = 'documents'
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );

create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and public.is_workspace_member(public.storage_object_workspace_id(name))
  );
