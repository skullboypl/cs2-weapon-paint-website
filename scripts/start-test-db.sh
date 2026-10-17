#!/usr/bin/env bash
set -euo pipefail
. /workspace/.cloud-tools/activate
cloudhub_tools=/workspace/.cloud-tools
if [ ! -d "$cloudhub_tools/test-mysql/mysql" ]; then
 "$cloudhub_tools/sysroot/usr/bin/mariadb-install-db" --no-defaults --basedir="$cloudhub_tools/sysroot/usr" --datadir="$cloudhub_tools/test-mysql" --auth-root-authentication-method=socket --skip-test-db
fi
exec "$cloudhub_tools/sysroot/usr/sbin/mariadbd" --no-defaults --basedir="$cloudhub_tools/sysroot/usr" --datadir="$cloudhub_tools/test-mysql" --socket="$cloudhub_tools/test-mysql.sock" --pid-file="$cloudhub_tools/test-mysql.pid" --skip-networking --log-error="$cloudhub_tools/test-mysql.log"
