# --- Build ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm config set fetch-retries 6 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 180000 \
 && npm config set fetch-timeout 600000 \
 && (npm ci --no-audit --no-fund || npm ci --no-audit --no-fund)
COPY . .
ARG VITE_BASE_PATH=/
ARG VITE_RESERVATION_API_URL=/api/reservation
ARG VITE_AUTH_API_URL=/api/auth
ARG VITE_VEHICLE_ASSETS_URL=/api/vehicule
ARG VITE_MODULE_VEHICULES_URL=
ARG VITE_MODULE_CONTRATS_URL=
ARG VITE_MODULE_RETOURS_URL=
ARG VITE_MODULE_PARAMETRES_URL=
ENV VITE_BASE_PATH=$VITE_BASE_PATH VITE_RESERVATION_API_URL=$VITE_RESERVATION_API_URL VITE_AUTH_API_URL=$VITE_AUTH_API_URL VITE_VEHICLE_ASSETS_URL=$VITE_VEHICLE_ASSETS_URL \
    VITE_MODULE_VEHICULES_URL=$VITE_MODULE_VEHICULES_URL VITE_MODULE_CONTRATS_URL=$VITE_MODULE_CONTRATS_URL \
    VITE_MODULE_RETOURS_URL=$VITE_MODULE_RETOURS_URL VITE_MODULE_PARAMETRES_URL=$VITE_MODULE_PARAMETRES_URL
RUN npm run build

# --- Serveur statique + proxy API ---
FROM nginx:1.27-alpine
# Le modèle est traité par envsubst au démarrage (image nginx officielle)
ENV RESERVATION_API_UPSTREAM=http://service_reservation:8000 \
    AUTH_API_UPSTREAM=http://service_auth:8000 \
    VEHICLE_API_UPSTREAM=http://service_vehicule:8000 \
    NGINX_ENVSUBST_FILTER=_UPSTREAM$
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
