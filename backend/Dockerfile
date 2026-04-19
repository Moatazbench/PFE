FROM node:20-alpine

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