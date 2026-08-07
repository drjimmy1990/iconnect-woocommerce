# Supabase Database Backup & Restore Guide

> **Rule #1:** Always take a backup before running migrations or making schema changes.

---

## Flags Reference

| Flag | Meaning | Your Value | Notes |
|------|---------|------------|-------|
| `-h` | **Host** — server address | `localhost` | Change if DB is on another server |
| `-p` | **Port** — PostgreSQL port | `5432` | Default Postgres port |
| `-U` | **User** — database username | `postgres` | Supabase default superuser |
| `-d` | **Database** — database name | `postgres` | Supabase default database name |
| `-F c` | **Format** — output format | `c` = custom (compressed) | Use `p` for plain SQL text |
| `-f` | **File** — output file path | `/root/backup.dump` | Where to save the backup |
| `-t` | **Table** — specific table | `public.messages` | Only backup this table |
| `--clean` | Drop objects before restoring | — | Ensures a clean restore |
| `--if-exists` | Don't error if object doesn't exist | — | Safer with `--clean` |
| `--data-only` | Skip schema, dump data only | — | Use when schema hasn't changed |
| `--schema-only` | Skip data, dump schema only | — | Use for structure backup |

---

## Password Authentication

PostgreSQL won't accept `-password` as a flag. Use one of these methods:

### Method 1: Inline with `PGPASSWORD` (Easiest)

```bash
PGPASSWORD='your-db-password' pg_dump -h localhost -p 5432 -U postgres -d postgres -F c -f backup.dump
```

### Method 2: `-W` Flag (Prompts You)

```bash
pg_dump -h localhost -p 5432 -U postgres -W -d postgres -F c -f backup.dump
# It will ask: Password: ****
```

### Method 3: `.pgpass` File (Permanent — No Password in Commands)

```bash
# Create the file (format: host:port:database:user:password)
echo "localhost:5432:postgres:postgres:your-db-password" > ~/.pgpass
chmod 600 ~/.pgpass

# Now all pg_dump/psql commands work without typing password
pg_dump -h localhost -p 5432 -U postgres -d postgres -F c -f backup.dump
```

---

## Quick Backup — Copy & Paste

```bash
pg_dump -h localhost -p 5432 -U postgres -d postgres -F c -f /root/supabase_backup_$(date +%Y%m%d_%H%M%S).dump

pg_dump -h supabase.bestlifeeg.store -p 5432 -U postgres.your-tenant-id -d postgres -F c -f /root/supabase_backup_$(date +%Y%m%d_%H%M%S).dump
```

pg_dump -h supabase.bestlifeeg.store -p 5432 -U postgres.your-tenant-id -d postgres > backup-latest-schema.sql

This creates a timestamped compressed backup like `supabase_backup_20260521_233800.dump`.

---

## Quick Restore — Copy & Paste

```bash
pg_restore -h localhost -p 5432 -U postgres -d postgres --clean --if-exists /root/supabase_backup_XXXXXXXX.dump
```

> Replace `XXXXXXXX` with the actual timestamp from your backup file.

---

## Backup Types

### Full Backup (Schema + Data) — Recommended

```bash
pg_dump -h localhost -p 5432 -U postgres -d postgres -F c -f backup.dump
```

### SQL Backup (Human-Readable)

```bash
pg_dump -h localhost -p 5432 -U postgres -d postgres > backup.sql
```

### Data Only (No Schema)

```bash
pg_dump -h localhost -p 5432 -U postgres -d postgres --data-only > data_only.sql
```

### Schema Only (No Data)

```bash
pg_dump -h supabase.bestlifeeg.store -p 5432 -U postgres.your-tenant-id -d postgres --schema-only > backup-latest-schema-only.sql
```

### Single Table Backup

```bash
# Replace 'public.messages' with the table name
pg_dump -h localhost -p 5432 -U postgres -d postgres -t public.messages > messages.sql
```

### Multiple Tables

```bash
pg_dump -h localhost -p 5432 -U postgres -d postgres \
  -t public.messages \
  -t public.contacts \
  -t public.channels \
  > selected_tables.sql
```

---

## Restore Methods

### From .dump (Compressed)

```bash
pg_restore -h localhost -p 5432 -U postgres -d postgres --clean --if-exists backup.dump
```

### From .sql (Plain Text)

```bash
psql -h localhost -p 5432 -U postgres -d postgres < backup.sql
```

### Restore Single Table from .dump

```bash
pg_restore -h localhost -p 5432 -U postgres -d postgres --clean -t public.messages backup.dump
```

---

## Docker (If Supabase Runs in Docker)

### Find your container name

```bash
docker ps | grep postgres
```

### Backup

```bash
docker exec -t supabase-db pg_dump -U postgres > /root/backup.sql
```

### Restore

```bash
cat /root/backup.sql | docker exec -i supabase-db psql -U postgres
```

---

## Before Running Migrations

**Always do this first:**

```bash
# 1. Take a full backup
pg_dump -h localhost -p 5432 -U postgres -d postgres -F c -f /root/supabase_backup_before_migration.dump

# 2. Verify the backup file exists and has data
ls -lh /root/supabase_backup_before_migration.dump

# 3. List contents to make sure it's valid
pg_restore -l /root/supabase_backup_before_migration.dump | head -20

# 4. Now run your migrations safely
psql -h localhost -p 5432 -U postgres -d postgres -f /path/to/migration.sql
```

**If something goes wrong:**

```bash
# Restore everything back
pg_restore -h localhost -p 5432 -U postgres -d postgres --clean --if-exists /root/supabase_backup_before_migration.dump
```

---

## Scheduled Automatic Backups

Add a daily backup cron job:

```bash
# Open crontab
crontab -e

# Add this line (backs up daily at 3 AM, keeps last 7 days)
0 3 * * * pg_dump -h localhost -p 5432 -U postgres -d postgres -F c -f /root/backups/supabase_$(date +\%Y\%m\%d).dump && find /root/backups -name "supabase_*.dump" -mtime +7 -delete
```

Create the backups directory first:

```bash
mkdir -p /root/backups
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Full backup | `pg_dump -h localhost -p 5432 -U postgres -F c -f backup.dump` |
| SQL backup | `pg_dump -h localhost -p 5432 -U postgres > backup.sql` |
| Data only | `pg_dump --data-only -h localhost -p 5432 -U postgres > data.sql` |
| Schema only | `pg_dump --schema-only -h localhost -p 5432 -U postgres > schema.sql` |
| Single table | `pg_dump -t public.TABLE_NAME -h localhost -p 5432 -U postgres > table.sql` |
| Restore .dump | `pg_restore --clean --if-exists -h localhost -p 5432 -U postgres -d postgres backup.dump` |
| Restore .sql | `psql -h localhost -p 5432 -U postgres -d postgres < backup.sql` |
| List backup contents | `pg_restore -l backup.dump` |
| Check backup size | `ls -lh backup.dump` |
| Docker backup | `docker exec -t supabase-db pg_dump -U postgres > backup.sql` |
