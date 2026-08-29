FROM node:22-alpine AS builder

# Patch CVE-2026-73566: Upgrade tar to v7.5.21
RUN npm install -g npm@latest && \
    npm install -g tar@7.5.21

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk update && apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
