FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
COPY .env.example ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
