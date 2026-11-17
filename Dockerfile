# Estágio de build: gera o site com as mesmas versões do .mise.toml.
FROM node:22-slim AS build
WORKDIR /build
RUN npm install -g pnpm@10.34.3
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN pnpm build

# Estágio final: Nginx serve o site e encaminha /api para a API. Imagem sem root (uid 101), na porta 8080
# (issue #171); o pid e os arquivos temporários ficam em /tmp, que no Docker Compose é um tmpfs.
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/cabecalhos-seguranca.conf /etc/nginx/snippets/cabecalhos-seguranca.conf
COPY --from=build /build/dist /usr/share/nginx/html
