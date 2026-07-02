FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app

# Prevent playwright from downloading browser binaries during npm install,
# since they are already pre-installed in the base image.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
