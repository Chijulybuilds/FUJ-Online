-- Refresh PostgREST's schema cache after applying the database migrations.
notify pgrst, 'reload schema';
