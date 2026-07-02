FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Update Node.js to version 22 using NodeSource to support native WebSocket for Supabase
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Prevent playwright from downloading browser binaries during npm install,
# since they are already pre-installed in the base image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./
COPY scripts/ ./scripts/
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
