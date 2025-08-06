# Use official Node 20.18.3 base image
FROM node:20.18.3

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Optional: install global tools if needed
# RUN npm install -g sequelize-cli nodemon

# Copy rest of the code
COPY . .

# Prettify code
RUN npm run format

# Build TypeScript if you're using it
# RUN npm run build

# Expose app port (adjust as needed)
EXPOSE 3000

# Start app in development mode
CMD ["npm", "run", "dev"]