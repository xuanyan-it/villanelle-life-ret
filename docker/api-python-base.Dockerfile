FROM node:20-bookworm

WORKDIR /app

# System deps:
# - build-essential: for native node modules
# - python3/pip3: for model worker runtime
RUN sed -i 's|http://deb.debian.org/debian|https://mirrors.aliyun.com/debian|g' /etc/apt/sources.list.d/debian.sources \
  && sed -i 's|http://deb.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources \
  && sed -i 's|http://security.debian.org/debian-security|https://mirrors.aliyun.com/debian-security|g' /etc/apt/sources.list.d/debian.sources \
  && printf 'Acquire::Retries "5";\nAcquire::http::Timeout "20";\nAcquire::https::Timeout "20";\n' > /etc/apt/apt.conf.d/99ci-network \
  && apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv python3-dev libsqlite3-dev build-essential \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm (repo uses pnpm via packageManager field)
RUN corepack enable && corepack prepare pnpm@10.6.2 --activate

# PEP 668: Debian/Bookworm blocks system-wide pip installs.
# Install Python deps into an isolated virtualenv.
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="${VIRTUAL_ENV}/bin:${PATH}"
RUN --mount=type=cache,target=/root/.cache/pip \
  pip install --upgrade pip setuptools wheel

ARG PIP_INDEX_URL=https://pypi.org/simple
COPY assets/models/requirements.lock.txt ./assets/models/requirements.lock.txt
COPY assets/models/requirements.txt ./assets/models/requirements.txt

# Keep containerized apsw pin aligned with current platform wheel support.
RUN sed -i 's/apsw==3\.52\.0\.0/apsw==3.51.3.0/g' ./assets/models/requirements.lock.txt \
  && sed -i 's/apsw==3\.52\.0\.0/apsw==3.51.3.0/g' ./assets/models/requirements.txt || true
RUN --mount=type=cache,target=/root/.cache/pip \
  pip install --retries 5 --timeout 60 \
  -i "${PIP_INDEX_URL}" \
  -r ./assets/models/requirements.lock.txt
