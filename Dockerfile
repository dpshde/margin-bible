FROM oven/bun:1.4.2
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
ENV PORT=8787
EXPOSE 8787
CMD ["bun", "src/preview-server.ts"]
