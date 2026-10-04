#!/bin/sh
set -eu

case "${MYSQL_USER:-}" in
  ''|*[!A-Za-z0-9_]* )
    echo "MYSQL_USER must contain only letters, digits, and underscores" >&2
    exit 1
    ;;
esac

# Flyway's MySQL support reads this session-variable view while it temporarily
# changes foreign_key_checks. Keep the application account scoped to this one
# read-only system table rather than using the database root account.
MYSQL_PWD="${MYSQL_ROOT_PASSWORD}" mysql --protocol=socket -uroot \
  -e "GRANT SELECT ON performance_schema.user_variables_by_thread TO '${MYSQL_USER}'@'%'; FLUSH PRIVILEGES;"
