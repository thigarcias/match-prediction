FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY tsconfig.json ./
COPY src/ ./src/
COPY data/ ./data/

RUN npm install typescript --save-dev && npx tsc && npm prune --omit=dev

EXPOSE 3000

CMD ["node", "dist/server-http.js"]
