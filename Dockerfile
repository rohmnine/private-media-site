FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /app/assets/video /app/assets/photos /app/assets/audio /app/data /app/trash/video /app/trash/photos /app/trash/audio /app/thumbnails/video /app/thumbnails/photos /app/thumbnails/audio

EXPOSE 8080
CMD ["npm", "start"]
