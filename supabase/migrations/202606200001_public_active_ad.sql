drop policy if exists "published ads are public readable" on public.ads;
create policy "published ads are public readable"
  on public.ads for select
  to anon
  using (status = 'published');
