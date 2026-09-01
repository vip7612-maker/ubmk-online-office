#!/usr/bin/env bash
# Turso 데이터베이스를 로컬 파일로 내려받는다.
#   ./scripts/backup.sh              → backups/ubmk-office-YYYYMMDD-HHMM.db
#   BACKUP_DIR=/경로 ./scripts/backup.sh
#
# 되돌릴 때는 새 DB로 올린 뒤 이름을 바꿔 쓰는 편이 안전하다:
#   turso db create ubmk-office-restore --from-file <백업파일>
set -euo pipefail

DB="${DB_NAME:-ubmk-office}"
DIR="${BACKUP_DIR:-$(cd "$(dirname "$0")/.." && pwd)/backups}"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$DIR/$DB-$STAMP.db"

mkdir -p "$DIR"
turso db export "$DB" --output-file "$OUT" --overwrite

# 30일이 지난 백업은 정리한다.
find "$DIR" -name "$DB-*.db*" -type f -mtime +30 -delete 2>/dev/null || true

echo "백업 완료: $OUT ($(du -h "$OUT" | cut -f1))"
ls -1t "$DIR" | head -5
