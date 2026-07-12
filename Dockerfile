FROM node:20-slim

WORKDIR /app

# Install Node dependencies
COPY package*.json ./
RUN npm install

# Copy application files
COPY api-server.js ./

# Expose port (Render uses PORT env variable, defaulting to 3001)
EXPOSE 3001

CMD ["node", "api-server.js"]
