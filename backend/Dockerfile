FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Update Node.js to version 22 using NodeSource to support native WebSocket for Supabase
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs

WORKDIR /app

# Browsers are pre-installed in the base image at /ms-playwright.
# Set the path BEFORE npm install so postinstall.js does NOT trigger a second download.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./
COPY scripts/ ./scripts/

# npm_config_ignore_scripts skips postinstall so Playwright doesn't re-download browsers
RUN npm install --ignore-scripts

COPY . .

EXPOSE 8080

CMD ["node", "index.js"]

