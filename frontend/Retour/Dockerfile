# Frontend Retour (React + Vite) : construit puis servi par nginx
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
# package-lock.json n'est pas à jour : npm install plutôt que npm ci
RUN npm install --no-audit --no-fund
COPY . .
ARG VITE_RETOUR_API_URL=
ARG VITE_ADMIN_URL=
ENV VITE_RETOUR_API_URL=$VITE_RETOUR_API_URL VITE_ADMIN_URL=$VITE_ADMIN_URL
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
