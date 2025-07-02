# Model Context Protocol (MCP) Server

This MCP server exposes the same workflow tools used by the LLM through the Model Context Protocol, allowing external clients to interact with the workflow system.

## Overview

The MCP server provides a standardized interface for tool execution, making it easy to integrate with various MCP clients and AI assistants. It shares the same tool implementations as the LLM system to avoid code duplication.

## Endpoints

### GET /api/mcp

Returns server information and available tools.

**Response:**

```json
{
  "server": {
    "name": "workflow-tools-server",
    "version": "1.0.0"
  },
  "tools": [
    {
      "name": "saveCase",
      "description": "Creates a new case or updates an existing case...",
      "parameters": {
        "type": "object",
        "properties": {
          "id": {
            "type": "integer",
            "description": "Case ID (required for update, omit for create)"
          },
          "name": {
            "type": "string",
            "description": "Case name"
          },
          "description": {
            "type": "string",
            "description": "Case description"
          },
          "model": {
            "type": "object",
            "description": "Workflow model with stages array",
            "properties": {
              "stages": {
                "type": "array",
                "items": {},
                "description": "Stages array"
              }
            },
            "required": ["stages"]
          }
        },
        "required": ["name", "description", "model"]
      }
    }
  ]
}
```

### POST /api/mcp

Handles MCP protocol requests over HTTP.

#### Available Methods

1. **initialize** - Initialize the MCP connection
2. **tools/list** - List available tools
3. **tools/call** - Execute a tool

#### Example Requests

**Initialize:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize"
}
```

**List Tools:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

**Call Tool:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "saveCase",
    "arguments": {
      "name": "Test Workflow",
      "description": "A test workflow",
      "model": {
        "stages": []
      }
    }
  }
}
```

## Available Tools

The MCP server exposes the following tools:

### saveCase

Creates or updates a case with a workflow model.

### saveField

Creates or updates a field for data collection.

### saveView

Creates or updates a view for information collection.

### deleteCase

Deletes a case and all associated fields and views.

### deleteField

Deletes a field.

### deleteView

Deletes a view.

### listFields

Lists all fields for a specific case.

### listViews

Lists all views for a specific case.

### getCase

Gets the details of a specific case including its workflow model.

## Architecture

The MCP server uses a shared tools architecture:

1. **sharedTools.ts** - Contains the core tool implementations
2. **llmTools.ts** - Provides LLM-compatible tool interface
3. **openaiToolSchemas.ts** - Generates OpenAI function calling schemas
4. **mcp/route.ts** - MCP server implementation

This design ensures:

- No code duplication between LLM and MCP interfaces
- Consistent tool behavior across all interfaces
- Easy maintenance and updates
- Type safety and validation

## Testing

Run the MCP server tests:

```bash
npm test src/app/api/mcp/__tests__/mcp.test.ts
```

## Integration

To integrate with an MCP client:

1. Configure the client to connect to `http://localhost:3100/api/mcp`
2. Use the standard MCP protocol for tool discovery and execution
3. The server supports both HTTP and stdio transports

## Error Handling

The server returns standard JSON-RPC 2.0 error responses:

- `-32601`: Method not found
- `-32603`: Internal error (tool execution failed)
- `-32700`: Parse error (invalid JSON)

## Development

To add new tools:

1. Add the tool implementation to `sharedTools.ts`
2. The tool will automatically be available in:
   - LLM function calling
   - MCP server
   - OpenAI tool schemas

This ensures consistency across all interfaces without requiring changes to multiple files.
