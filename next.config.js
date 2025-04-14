/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  },
  // Ensure environment variables are available at build time
  serverRuntimeConfig: {
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
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
};

module.exports = nextConfig;
