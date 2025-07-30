#!/usr/bin/env node

/**
 * Simple MCP Client for Claude Desktop
 *
 * This client acts as a bridge between Claude Desktop and your MCP server.
 * It reads JSON-RPC requests from stdin and forwards them to the MCP server,
 * then writes the responses back to stdout.
 *
 * Usage:
 *   node simple-mcp-client.js <server-url>
 *
 * Examples:
 *   node simple-mcp-client.js http://localhost:3100/api/mcp
 *   node simple-mcp-client.js https://your-app.vercel.app/api/mcp
 *
 * The client supports both HTTP and HTTPS URLs and will automatically
 * use the appropriate protocol.
 *
 * For Claude Desktop configuration, use this as the MCP server command:
 *   /path/to/node /path/to/simple-mcp-client.js https://your-app.vercel.app/api/mcp
 */

const http = require("http");
const https = require("https");

class SimpleMCPClient {
  constructor(url) {
    this.url = new URL(url);
    // Force IPv4 to avoid IPv6 connection issues
    this.hostname =
      this.url.hostname === "localhost" ? "127.0.0.1" : this.url.hostname;
    this.isHttps = this.url.protocol === "https:";
  }

  async request(data, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await this._makeRequest(data);
      } catch (error) {
        console.error(`Request attempt ${attempt} failed:`, error.message);
        if (attempt === retries) {
          throw error;
        }
        // Wait before retrying (exponential backoff)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.pow(2, attempt) * 100),
        );
      }
    }
  }

  async _makeRequest(data) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        port: this.url.port || (this.isHttps ? 443 : 80),
        path: this.url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Connection: "keep-alive",
        },
      };

      console.error(
        `Making ${this.isHttps ? "HTTPS" : "HTTP"} request to ${
          this.hostname
        }:${options.port}${options.path}`,
      );

      // Use https for HTTPS URLs, http for HTTP URLs
      const client = this.isHttps ? https : http;
      const req = client.request(options, (res) => {
        console.error(
          `Received response: ${res.statusCode} ${res.statusMessage}`,
        );

        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            if (body.trim()) {
              console.error(`Response body length: ${body.length} characters`);
              resolve(JSON.parse(body));
            } else {
              // Handle empty responses
              console.error("Received empty response");
              resolve(null);
            }
          } catch (error) {
            console.error(`Failed to parse response: ${error.message}`);
            console.error(`Response body: ${body.substring(0, 200)}...`);
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on("error", (error) => {
        console.error(`HTTP request error: ${error.message}`);
        reject(error);
      });

      // Set a reasonable timeout (increased to 15 seconds)
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });

      const requestBody = JSON.stringify(data);
      console.error(
        `Sending request body: ${requestBody.substring(0, 100)}...`,
      );
      req.write(requestBody);
      req.end();
    });
  }
}

async function main() {
  const url = process.argv[2] || "http://localhost:3100/api/mcp";
  const client = new SimpleMCPClient(url);

  console.error("Simple MCP client connecting to: " + url);

  // Set up stdin/stdout for Claude Desktop
  process.stdin.setEncoding("utf8");

  // Buffer for incomplete JSON lines
  let buffer = "";

  process.stdin.on("data", async (chunk) => {
    // Add new chunk to buffer
    buffer += chunk;

    // Process complete lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer

    for (const line of lines) {
      if (line.trim() === "") continue; // Skip empty lines

      let request = null;
      try {
        request = JSON.parse(line.trim());
        console.error(
          `Processing request: ${request.method} (ID: ${request.id})`,
        );

        // Handle notifications (messages without id) - just ignore them
        if (typeof request.id === "undefined") {
          continue;
        }

        // Forward ALL requests to the MCP server, including initialize
        const response = await client.request(request);
        if (response) {
          console.error(
            `Sending response for ${request.method} (ID: ${request.id})`,
          );
          process.stdout.write(JSON.stringify(response) + "\n");
        } else {
          // Handle case where server doesn't return a response
          const errorResponse = {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: "No response from MCP server",
            },
          };
          console.error(
            `No response from server for ${request.method} (ID: ${request.id})`,
          );
          process.stdout.write(JSON.stringify(errorResponse) + "\n");
        }
      } catch (error) {
        console.error(`Error processing request:`, error.message);
        console.error(`Failed line: "${line}"`);
        // Only send error response if this was a request (has id), not a notification
        if (request && typeof request.id !== "undefined") {
          const errorResponse = {
            jsonrpc: "2.0",
            id: request.id,
            error: {
              code: -32603,
              message: error.message,
            },
          };
          process.stdout.write(JSON.stringify(errorResponse) + "\n");
        }
      }
    }
  });

  // Handle process termination
  process.on("SIGINT", () => {
    console.error("Shutting down simple MCP client");
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    console.error("Shutting down simple MCP client");
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal error in MCP client:", err);
    process.exit(1);
  });
}
