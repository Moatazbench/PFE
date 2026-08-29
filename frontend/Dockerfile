FROM node:22-alpine AS builder

# Upgrade npm and patch bundled dependencies
RUN npm install -g npm@latest && \
    npm install -g tar@6.2.1

WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
RUN apk upgrade --no-cache
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
