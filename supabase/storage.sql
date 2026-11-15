-- Run once in the Supabase SQL editor.
-- Replace 00000000-0000-0000-0000-000000000000 with YOUR Supabase Auth user UUID.
-- Private bucket: documents are NOT publicly accessible.
insert into storage.buckets (id,name,public,file_size_limit)
values ('project-documents','project-documents',false,52428800)
on conflict (id) do update set public=false;

create policy "ASPKSA owner read" on storage.objects
for select to authenticated
using (bucket_id='project-documents' and (storage.foldername(name))[1]='ASPKSA'
and auth.uid()='00000000-0000-0000-0000-000000000000'::uuid);

create policy "ASPKSA owner upload" on storage.objects
for insert to authenticated
with check (bucket_id='project-documents' and (storage.foldername(name))[1]='ASPKSA'
and auth.uid()='00000000-0000-0000-0000-000000000000'::uuid);

create policy "ASPKSA owner delete" on storage.objects
for delete to authenticated
using (bucket_id='project-documents' and (storage.foldername(name))[1]='ASPKSA'
and auth.uid()='00000000-0000-0000-0000-000000000000'::uuid);
