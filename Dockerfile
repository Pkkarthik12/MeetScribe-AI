# Use lightweight Node LTS base
FROM node:18-slim

# Install Chromium and system dependencies for Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    fonts-freefont-ttf \
    libxss1 \
    libasound2 \
    pulseaudio \
    xvfb \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for Puppeteer to use the installed Chromium binary
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_BIN=/usr/bin/chromium \
    NODE_ENV=production

# Set up working directory
WORKDIR /usr/src/app

# Copy dependency configs
COPY package*.json ./

# Install npm packages
RUN npm ci --only=production

# Copy application files
COPY . .

# Expose Express server port
EXPOSE 3000

# Start PulseAudio virtual server and launch the application
CMD pulseaudio -D --exit-idle-time=-1 && npm start
