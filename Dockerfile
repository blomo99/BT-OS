# BT OS — production image (Railway or any Docker host).
# Debian-based so better-sqlite3 uses its prebuilt glibc binaries.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

ENV NODE_ENV=production
# next start honors PORT (Railway injects it); SQLite lives on the volume
# mounted at BTOS_DATA_DIR (set BTOS_DATA_DIR=/data with a volume at /data).
EXPOSE 3000
CMD ["npm", "start"]
