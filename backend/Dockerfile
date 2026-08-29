FROM node:22-alpine

# Upgrade npm and patch bundled dependencies
RUN npm install -g npm@latest && \
    npm install -g tar@6.2.1 && \
    # Patch npm's bundled tar package
    npm list -g tar && \
    # Force npm to use patched tar
    npm update -g tar

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