# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Opcional: se o EasyPanel repassar as variáveis no build, elas entram aqui também.
# O caminho principal é o /config.js gerado quando o container liga (docker/config.sh).
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL \
    VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# ---- serve ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
# Gera /config.js a partir das variáveis de ambiente toda vez que o container liga
COPY docker/config.sh /docker-entrypoint.d/40-conex-config.sh
RUN chmod +x /docker-entrypoint.d/40-conex-config.sh
EXPOSE 80
