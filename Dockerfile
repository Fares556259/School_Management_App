
# Use the Node.js version compatible with your project
FROM node:22-bookworm-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application source code
COPY . .

# BuildKit mounts .env temporarily for the build.
# It is NOT copied into the resulting image.
RUN --mount=type=secret,id=app_env,dst=/app/.env \
    npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start"]
