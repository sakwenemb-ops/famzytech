#!/bin/sh
# Daily backup of the database and the uploaded files into ./backups (keeps 14 days).
# Run from this folder, e.g. with cron:  15 2 * * * cd /opt/learn-quick/learn-quick/deploy && ./backup.sh
set -e
cd "$(dirname "$0")"
mkdir -p backups
stamp=$(date +%Y-%m-%d)
docker compose exec -T db pg_dump -U learnquick -d learnquick --format=custom > "backups/db-$stamp.dump"
docker compose run --rm --no-deps -T --entrypoint "" app tar -czf - -C /data storage > "backups/files-$stamp.tar.gz"
find backups -type f -mtime +14 -delete
echo "Backup written: backups/db-$stamp.dump and backups/files-$stamp.tar.gz"
# Copy the backups folder to another place too (another server or cloud storage).
