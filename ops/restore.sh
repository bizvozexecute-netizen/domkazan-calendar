#!/bin/sh
set -eu
archive=${1:?Specify an archive}
target=${2:?Specify a NEW *_test database}
case "$target" in *[!a-z0-9_]*|'') echo 'Invalid database name' >&2; exit 1;; esac
case "$target" in *_test) ;; *) echo 'Restore tool only accepts a NEW *_test database' >&2; exit 1;; esac
test -s "$archive"
(cd "$(dirname "$archive")" && sha256sum -c "$(basename "$archive").sha256")
# createdb fails if target already exists. There is deliberately no --clean or DROP of an existing database.
createdb --maintenance-db=postgres --template=template0 "$target"
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$target" "$archive"
echo "Restored into new test database: $target"
