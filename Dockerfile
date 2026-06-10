FROM node:18-bullseye

WORKDIR /app

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/

RUN npm install

# Copy rest of the code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 3000

# Wait for PostgreSQL to be ready, run migrations, then start the app
CMD ["/bin/sh", "-c", "npx prisma db push && npm start"]
