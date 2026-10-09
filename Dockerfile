# syntax=docker/dockerfile:1
# Static site: Astro build → nginx without root. TLS and the domain are on the host's nginx.

FROM node:22-alpine AS build
WORKDIR /src
# Only the manifests first: the dependency layer is reused until they change.
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
