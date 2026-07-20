ARG PYTHON_BASE_IMAGE=villanelleliferet-python-ml-base:latest
FROM ${PYTHON_BASE_IMAGE}

WORKDIR /app

# 1) Install Node deps (cacheable layer)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json

RUN pnpm install --frozen-lockfile --filter @villanelle/ret-server...

# 2) Copy only required source/assets for API image.
# This avoids shipping unrelated workspace content (e.g. frontend/electron)
# into the API image layers.
COPY tsconfig.json ./tsconfig.json
COPY shared ./shared
COPY server ./server
COPY assets/models ./server/assets/models
COPY assets/templates ./server/assets/templates

# Build server (shared is built by server's prebuild script)
RUN pnpm --filter @villanelle/ret-server build

EXPOSE 7001

# Use pnpm start so it matches server/package.json "start" script.
CMD ["pnpm", "--filter", "@villanelle/ret-server", "start"]
