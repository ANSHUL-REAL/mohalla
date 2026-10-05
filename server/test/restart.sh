#!/bin/sh
# Restart the isolated test server on port 5055 with a fresh DB (never touches port 5000 / data.db)
cd "$(dirname "$0")/.."
PID=$(netstat -ano | grep -E "0\.0\.0\.0:5055 .*LISTENING" | awk '{print $5}' | head -1)
[ -n "$PID" ] && taskkill //PID "$PID" //F >/dev/null 2>&1
sleep 1
rm -f test/test.db test/test.db-*
DB_FILE=./test/test.db PORT=5055 node --no-warnings index.js > test/server.log 2>&1 &
for i in 1 2 3 4 5 6 7 8 9 10; do curl -s 127.0.0.1:5055/api/stats >/dev/null && break; sleep 1; done
curl -s 127.0.0.1:5055/api/stats; echo
