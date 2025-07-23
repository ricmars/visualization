# My App

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Configuration

**IMPORTANT**: This project uses:

- **Port**: 3100
- **Package Manager**: npm
- **Database Reset**: `curl -X POST http://localhost:3100/api/reset-db`

## Available Scripts

- `npm run dev` - Start development server on port 3100
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
