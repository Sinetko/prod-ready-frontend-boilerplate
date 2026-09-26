# syntax=docker/dockerfile:1
ARG NODE_IMAGE=node:24.21.0-bookworm-slim
ARG NGINX_IMAGE=nginx:1.30.5-alpine

FROM ${NODE_IMAGE} AS dependencies
ARG NPM_VERSION=12.1.0
ENV HUSKY=0
WORKDIR /app
RUN npm install --global "npm@${NPM_VERSION}"
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM dependencies AS build
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json tsconfig.vite.json .swcrc ./
COPY src/ ./src/
RUN npm run build

FROM ${NGINX_IMAGE} AS runtime
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY --from=build /app/dist/ /usr/share/nginx/html/
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["nginx"]
CMD ["-g", "daemon off;"]
