# My App

## Project Configuration

**IMPORTANT**: This project uses:

- **Port**: 3100 (not 3000)
- **Package Manager**: npm (not pnpm)
- **Database Reset**: `curl -X POST http://localhost:3100/api/reset-db`

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3100](http://localhost:3100) with your browser to see the result.

## Available Scripts

- `npm run dev` - Start development server on port 3100
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
