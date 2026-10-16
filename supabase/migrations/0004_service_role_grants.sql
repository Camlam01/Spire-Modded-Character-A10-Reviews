-- Make sure the site's server key can use every table and view, including ones created later, and tell the API to
-- pick up the new tables straight away. Some Supabase projects don't grant this automatically to objects created in
-- the SQL Editor. The service role key is only ever used on the server; the public key stays blocked.

grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

notify pgrst, 'reload schema';
