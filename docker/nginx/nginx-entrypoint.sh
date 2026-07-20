#!/bin/sh
set -eu

# Select which nginx config to use at startup.
# - NGINX_SSL_ENABLED=true  => use TLS config (listens on 443)
# - anything else           => use HTTP config (listens on 80)
SSL_ENABLED="${NGINX_SSL_ENABLED:-false}"

if [ "$SSL_ENABLED" = "true" ] || [ "$SSL_ENABLED" = "1" ]; then
  cp /etc/nginx/templates/default.ssl.template /etc/nginx/conf.d/default.conf
else
  cp /etc/nginx/templates/default.http.template /etc/nginx/conf.d/default.conf
fi

exec "$@"

