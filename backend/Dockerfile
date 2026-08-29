FROM node:22-alpine

# Patch CVE-2026-73566: Upgrade tar to v7.5.21
RUN npm install -g npm@latest && \
    npm install -g tar@7.5.21

WORKDIR /app

COPY package*.json ./

RUN npm config set registry https://registry.npmjs.org/ \
 && npm config set fetch-retries 5 \
 && npm config set fetch-retry-mintimeout 20000 \
 && npm config set fetch-retry-maxtimeout 120000 \
 && npm ci --omit=dev --no-audit --no-fund \
 && npm cache clean --force

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]