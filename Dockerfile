# Coolify bu dosyayı otomatik algılar (Build Pack: Dockerfile).

# --- 1. aşama: derleme
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# --- 2. aşama: çalışma (sadece gerekli dosyalar)
FROM node:24-alpine
WORKDIR /app
# Ortam değişkenleri burada (gizli bilgi değiller, kaynak kodda durabilirler).
# Coolify'da aynı adla değişken tanımlarsanız bunları ezer.
ENV NODE_ENV=production \
    PORT=4446 \
    ORIGIN=https://altyaziceviri.tr \
    TZ=Europe/Istanbul \
    SAYAC_DOSYASI=/app/data/sayac.json
COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# Ziyaretçi sayacı burada tutulur: Coolify'da bu klasöre kalıcı depolama (volume) bağlayın
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 4446
# Port, PORT değişkeninden okunur (Coolify PORT'u ezerse healthcheck de ona uyar)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/robots.txt" || exit 1
CMD ["node", "build"]
