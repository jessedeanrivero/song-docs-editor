create extension if not exists pgcrypto;

create table if not exists public.docs (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Untitled',
  owner_id uuid not null,
  project_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doc_content (
  doc_id uuid primary key references public.docs(id) on delete cascade,
  content_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists public.doc_permissions (
  doc_id uuid not null references public.docs(id) on delete cascade,
  user_id uuid not null,
  role text not null check (role in ('owner','editor','commenter','viewer')),
  created_at timestamptz not null default now(),
  primary key (doc_id, user_id)
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_docs_updated_at on public.docs;
create trigger trg_docs_updated_at
  before update on public.docs
  for each row execute function public.set_updated_at();

alter table public.docs enable row level security;
alter table public.doc_content enable row level security;
alter table public.doc_permissions enable row level security;

create or replace function public.has_doc_access(p_doc_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.doc_permissions dp
    where dp.doc_id = p_doc_id and dp.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_doc(p_doc_id uuid)
returns boolean language sql stable as $$
  select exists (
    select 1 from public.doc_permissions dp
    where dp.doc_id = p_doc_id and dp.user_id = auth.uid()
      and dp.role in ('owner','editor')
  );
$$;

drop policy if exists "docs_select" on public.docs;
create policy "docs_select"
  on public.docs for select
  using (public.has_doc_access(id));

drop policy if exists "docs_insert" on public.docs;
create policy "docs_insert"
  on public.docs for insert
  with check (auth.uid() = owner_id);

drop policy if exists "docs_update" on public.docs;
create policy "docs_update"
  on public.docs for update
  using (public.can_edit_doc(id))
  with check (public.can_edit_doc(id));

drop policy if exists "content_select" on public.doc_content;
create policy "content_select"
  on public.doc_content for select
  using (public.has_doc_access(doc_id));

drop policy if exists "content_upsert" on public.doc_content;
create policy "content_upsert"
  on public.doc_content for insert
  with check (public.can_edit_doc(doc_id));

drop policy if exists "content_update" on public.doc_content;
create policy "content_update"
  on public.doc_content for update
  using (public.can_edit_doc(doc_id))
  with check (public.can_edit_doc(doc_id));

drop policy if exists "perms_select" on public.doc_permissions;
create policy "perms_select"
  on public.doc_permissions for select
  using (public.has_doc_access(doc_id));

drop policy if exists "perms_insert_owner_only" on public.doc_permissions;
create policy "perms_insert_owner_only"
  on public.doc_permissions for insert
  with check (
    exists (
      select 1 from public.doc_permissions dp
      where dp.doc_id = doc_permissions.doc_id
        and dp.user_id = auth.uid()
        and dp.role = 'owner'
    )
  );

drop policy if exists "perms_update_owner_only" on public.doc_permissions;
create policy "perms_update_owner_only"
  on public.doc_permissions for update
  using (
    exists (
      select 1 from public.doc_permissions dp
      where dp.doc_id = doc_permissions.doc_id
        and dp.user_id = auth.uid()
        and dp.role = 'owner'
    )
  )
  with check (
    exists (
      select 1 from public.doc_permissions dp
      where dp.doc_id = doc_permissions.doc_id
        and dp.user_id = auth.uid()
        and dp.role = 'owner'
    )
  );
