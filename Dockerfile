FROM node:20-slim

# Install Python, FFmpeg, and curl
RUN apt-get update && apt-get install -y \
    python3 \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY server.js ./
COPY vite-plugin-api.js ./

# Expose port (Render uses PORT env variable, defaulting to 3001)
EXPOSE 3001

CMD ["node", "server.js"]
