#!/bin/sh
# 回滚镜像入口：仅替换四个上游占位符，保留 nginx 自身变量（$http_*、$remote_addr 等）。
sed -i \
  -e "s|\${RUNTIME_HOST}|${RUNTIME_HOST:-runtime}|g" \
  -e "s|\${RUNTIME_PORT}|${RUNTIME_PORT:-3061}|g" \
  -e "s|\${WEBSOCKET_HOST}|${WEBSOCKET_HOST:-websocket}|g" \
  -e "s|\${WEBSOCKET_PORT}|${WEBSOCKET_PORT:-3064}|g" \
  -e "s|apboa-console|${CONSOLE_HOST:-console}|g" \
  /etc/nginx/conf.d/default.conf
exec nginx -g "daemon off;"
