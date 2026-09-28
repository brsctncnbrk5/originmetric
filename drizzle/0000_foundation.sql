-- P0 foundation baseline migration.
-- Intentionally creates NO tables and changes no schema. It exists only to prove that the
-- migration workflow (committed SQL -> drizzle migrator -> drizzle.__drizzle_migrations)
-- works end to end. OriginMetric domain tables arrive in P1a.
SELECT 1;
