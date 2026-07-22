# mysql-import runbook

## What this skill needs

- Source Excel files in the project root
- Python 3
- `pymysql`
- MySQL reachable through environment variables

## Entry point

Run through the packaged wrapper inside this skill directory:

```bash
python .claude/skills/mysql-import/bin/run_mysql_import.py load-only --dry-run
```

Or run the full pipeline:

```bash
python .claude/skills/mysql-import/bin/run_mysql_import.py clean-and-load --dry-run
```

## Real import

After dry-run passes:

```bash
python .claude/skills/mysql-import/bin/run_mysql_import.py load-only
```

The real import initializes any missing loader tables with `CREATE TABLE IF NOT EXISTS` before writing rows.

## Initialize schema only

```bash
python .claude/skills/mysql-import/bin/run_mysql_import.py init-schema
```

## Environment variables

Copy `.env.example` values into your runtime environment.

PowerShell example:

```powershell
$env:MYSQL_HOST="localhost"
$env:MYSQL_PORT="3306"
$env:MYSQL_USER="root"
$env:MYSQL_PASSWORD=""
$env:MYSQL_DATABASE="sys"
```

## Notes

- Empty MySQL password is supported.
- Each import ensures the required tables exist, then creates a new `crawl_job` batch.
- Images are stored as exported files plus metadata paths, not blobs.
