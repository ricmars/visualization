# Contributing Guide

## Documentation Structure

- **`.cursor/rules/.cursorrules`**: AI assistant behavior rules, code style, testing requirements, and development patterns
- **`CONTRIBUTING.md`**: Human-focused documentation, setup instructions, troubleshooting, and code review guidelines

## Quick Reference

### Common Commands

```bash
# Development
npm run dev          # Start dev server on port 3100
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm test             # Run tests
npm run test:watch   # Run tests in watch mode
npm run test:coverage # Run tests with coverage
```

### Database Operations

- **Reset Database**: `curl -X POST http://localhost:3100/api/reset-db`
- **API Base**: http://localhost:3100/api

### Checkpoint System

The application includes a universal database-backed checkpoint system with comprehensive change history:

- **Check Status**: `curl -X GET http://localhost:3100/api/checkpoint`
- **View History**: `curl -X GET http://localhost:3100/api/checkpoint/history`
- **Manual Rollback**: `curl -X POST http://localhost:3100/api/checkpoint?action=rollback`
- **Manual Commit**: `curl -X POST http://localhost:3100/api/checkpoint?action=commit`
- **Restore to Point**: `curl -X POST http://localhost:3100/api/checkpoint?action=restore -d '{"checkpointId":"uuid"}'`

#### How It Works

1. **Universal Database-Layer Tracking**: All database modifications automatically create checkpoints at the `/api/database` layer
2. **LLM Sessions**: Group all AI actions from a single user prompt into one checkpoint for atomic rollback
3. **UI Operations**: Each workflow modification (add stage, delete field, etc.) creates an individual checkpoint
4. **MCP Interface**: Each tool execution creates an individual checkpoint automatically
5. **No Bypass Possible**: Every database change is tracked regardless of source (UI, AI, MCP, API)
6. **Referential Integrity**: Checkpoint restores maintain consistency across workflows, fields, and views

#### Supported Interfaces

- **UI Operations**: Direct `/api/database` calls with automatic individual checkpoints
- **LLM Chat Interface**: Session-based checkpoints grouping related AI actions
- **MCP Interface**: Automatic individual checkpoints for each tool execution
- **API Endpoints**: Manual checkpoint management and restoration

#### Changes History

The system maintains a complete history of all checkpoints with:

- **Original user commands** that triggered each checkpoint
- **Date/time** when each action was performed
- **Source identification** (UI vs LLM vs MCP vs API)
- **Tools executed** during each checkpoint session
- **Number of changes** made in each checkpoint
- **Point-in-time restoration** to any historical checkpoint

Access via:

- **Chat Interface**: Click "History" button to view timeline with restore options
- **API**: `GET /api/checkpoint/history` for programmatic access

#### Database Tables

- `checkpoints`: Session metadata and status
  - `id`: UUID primary key
  - `description`: Human-readable description
  - `user_command`: Original command that triggered the checkpoint
  - `status`: 'active', 'historical', 'committed', 'rolled_back'
  - `source`: 'UI', 'LLM', 'MCP', 'API'
  - `tools_executed`: JSON array of tools used
  - `changes_count`: Number of database changes
  - `created_at`, `finished_at`: Timestamps
- `undo_log`: Change tracking with inverse operations (checkpoint_id, operation, table_name, primary_key, previous_data)

#### Checkpoint Status Response

```json
{
  "activeSession": {...},
  "activeCheckpoints": [...],
  "summary": {
    "total": 2,
    "mcp": 1,
    "llm": 1
  }
}
```

#### Checkpoint History Response

```json
{
  "history": [
    {
      "id": "f47c2c58-f3a3-4de6-aaee-73cc2d9d71fe",
      "description": "MCP Tool: createCase",
      "user_command": "MCP createCase({\"name\":\"Test Case\"}...)",
      "status": "historical",
      "source": "MCP",
      "created_at": "2025-07-17T05:55:17.980Z",
      "finished_at": "2025-07-17T05:55:18.176Z",
      "tools_executed": ["createCase"],
      "changes_count": 1
    }
  ]
}
```

#### Data Consistency Benefits

- **Prevents Orphaned References**: Checkpoint restores automatically maintain referential integrity
- **Universal Tracking**: No operation can bypass checkpoint system - all DB changes are captured
- **Atomic Rollbacks**: Related changes (workflows, fields, views) are restored together
- **Root Cause Prevention**: Eliminates inconsistency issues where references point to deleted entities

#### Troubleshooting Checkpoints

- If rollback fails, check database logs for constraint violations
- Orphaned checkpoints can be cleaned up: `DELETE FROM checkpoints WHERE status = 'active' AND created_at < NOW() - INTERVAL '1 hour'`
- Monitor checkpoint performance: `SELECT COUNT(*) FROM undo_log WHERE checkpoint_id IN (SELECT id FROM checkpoints WHERE status = 'active')`
- Check checkpoint sources: `SELECT description, created_at FROM checkpoints WHERE status = 'active'`

## Required Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:password@ep-something.region.aws.neon.tech/dbname

# Azure OpenAI (if using)
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

## Database Setup

1. Create Neon account at https://neon.tech
2. Create new project and database
3. Copy connection string to `.env.local`
4. Reset database: `curl -X POST http://localhost:3100/api/reset-db`

## Need Help?

- Check the troubleshooting guide above
- Review the detailed examples
- Run tests to identify issues
- Check the `.cursor/rules/.cursorrules` for AI assistant patterns
- Ask for help in team discussions
