# syntax=docker/dockerfile:1
# Build from the repository root: docker build -f autotests/Dockerfile .
ARG NODE_IMAGE=node:24.21.0-bookworm-slim
FROM ${NODE_IMAGE} AS runner
ARG NPM_VERSION=12.1.0
ENV HUSKY=0 \
    CI=true \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
RUN npm install --global "npm@${NPM_VERSION}"
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY autotests/playwright/package.json autotests/playwright/package-lock.json ./autotests/playwright/
RUN npm --prefix autotests/playwright ci --no-audit --no-fund

WORKDIR /app/autotests/playwright
RUN npx --no-install playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --chown=node:node index.html vite.config.ts tsconfig.json tsconfig.node.json tsconfig.vite.json .swcrc ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node autotests/playwright/ ./autotests/playwright/
# npm ci created the package directory as root; allow the test user to write reports and caches.
RUN mkdir -p /app/node_modules/.vite /app/node_modules/.vite-temp \
    && chown node:node /app /app/autotests /app/autotests/playwright \
       /app/node_modules/.vite /app/node_modules/.vite-temp
USER node
WORKDIR /app/autotests/playwright
CMD ["npm", "test"]
