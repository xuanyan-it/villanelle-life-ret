FROM node:20-bookworm AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json
COPY frontend/package.json ./frontend/package.json
COPY electron/package.json ./electron/package.json

RUN pnpm install --frozen-lockfile --filter @villanelle/ret-frontend...

COPY . .

RUN pnpm --filter @villanelle/ret-frontend build


FROM nginx:1.27-alpine

# Two nginx configs:
# - default.http.conf: no TLS (used for test/local)
# - default.ssl.conf: TLS enabled (used for prod)
COPY docker/nginx/default.conf /etc/nginx/templates/default.http.template
COPY docker/nginx/default.ssl.conf /etc/nginx/templates/default.ssl.template
COPY docker/nginx/nginx-entrypoint.sh /nginx-entrypoint.sh

COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80
EXPOSE 443

RUN chmod +x /nginx-entrypoint.sh

ENTRYPOINT ["/nginx-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
