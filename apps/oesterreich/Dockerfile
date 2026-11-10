# Die große Österreich-Expedition – static HTML5 game served by unprivileged nginx (port 8080).
FROM node:22-alpine AS build
WORKDIR /app
COPY build.mjs ./
COPY src ./src
ARG GIT_SHA=dev
RUN node build.mjs --version "$GIT_SHA"

FROM nginxinc/nginx-unprivileged:1.27-alpine
ARG GIT_SHA=dev
LABEL org.opencontainers.image.title="oesterreich-expedition" \
      org.opencontainers.image.revision="$GIT_SHA" \
      org.opencontainers.image.source="https://github.com/vipeinvest/law-agent/tree/main/apps/oesterreich"
USER root
RUN rm -f /etc/nginx/conf.d/*.conf && mkdir -p /etc/nginx/snippets
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
RUN SAFE_SHA="$(printf '%s' "$GIT_SHA" | tr -cd 'A-Za-z0-9._-')" && sed -i "s/__VERSION__/${SAFE_SHA}/" /etc/nginx/conf.d/default.conf
COPY --from=build /app/public /usr/share/nginx/html
USER 101
ENV NGINX_ENTRYPOINT_QUIET_LOGS=1
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/health || exit 1
