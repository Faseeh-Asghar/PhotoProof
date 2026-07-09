FROM node:20-alpine

# Install dependencies for sharp (native bindings)
RUN apk add --no-cache \
  python3 \
  make \
  g++ \
  vips-dev \
  libc6-compat

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production deps
RUN npm ci --only=production

# Copy source
COPY src/ ./src/

# Create directories for uploads
RUN mkdir -p uploads processed zips

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "src/index.js"]
