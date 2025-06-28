/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
  },
  // Ensure environment variables are available at build time
  serverRuntimeConfig: {
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
  },
  // Validate required environment variables
  webpack: (config, { isServer }) => {
    if (isServer) {
      const requiredEnvVars = [
        "AZURE_OPENAI_ENDPOINT",
        "AZURE_OPENAI_DEPLOYMENT",
        "AZURE_TENANT_ID",
        "AZURE_CLIENT_ID",
        "AZURE_CLIENT_SECRET",
        "DATABASE_URL",
      ];

      const missingVars = requiredEnvVars.filter((name) => !process.env[name]);

      if (missingVars.length > 0) {
        console.error(
          "\nError: Required environment variables are missing:",
          missingVars.join(", "),
          "\nMake sure these are set in your .env file or environment.\n",
        );
        process.exit(1);
      }
    }
    return config;
  },
  // Ensure environment variables are available at build time
  publicRuntimeConfig: {
    // Add any public runtime configs here
  },
  experimental: {
    // Enable any experimental features here
  },
};

module.exports = nextConfig;
