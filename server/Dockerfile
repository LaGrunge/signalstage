FROM node:20-alpine

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY migrations ./migrations
# scripts/ is how validate-problems.mjs is meant to be run against a live
# deployment (docker compose exec api node scripts/validate-problems.mjs), so
# it has to be in the image, not copied in by hand each time.
COPY scripts ./scripts

EXPOSE 4000 1234
CMD ["node", "src/index.js"]
