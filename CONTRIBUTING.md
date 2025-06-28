# Contributing Guide

This document provides detailed examples, troubleshooting guides, and human-specific guidance for contributing to this workflow application. For AI assistant rules and patterns, see `.cursor/rules/.cursorrules`.

## Quick Reference

### Critical Rules (Always Follow)

- **Field Management**: Separate field definitions from field references
- **Database IDs**: Always use integer IDs, never strings
- **SQL Keywords**: Quote reserved keywords (`"primary"`, `"order"`)
- **Testing**: All tests in `__tests__` directories, no top-level test scripts
- **System Prompt**: Single source in `src/app/lib/databasePrompt.ts`

### Key Commands

```bash
# Development
pnpm dev                    # Start development server
pnpm test                   # Run all tests
pnpm test:coverage          # Generate coverage report

# Database
curl -X POST http://localhost:3100/api/reset-db  # Reset database after schema changes
```

## Detailed Examples

### Field Management Implementation

#### Field Reordering vs Adding Fields

```typescript
// Determine operation type
const isReorder =
  fieldIds.every((fieldId) =>
    existingFields.some((existingField) => existingField.id === fieldId),
  ) && fieldIds.length === existingFields.length;

// Reordering: preserve existing properties
const reorderedFields = fieldIds.map((fieldId) => ({
  id: fieldId,
  required: existingFields.find((f) => f.id === fieldId)?.required ?? false,
}));

// Adding: preserve existing, add new
const newFields = fieldIds.map((fieldId) => ({
  id: fieldId,
  required: false,
}));
const combinedFields = [
  ...existingFields,
  ...newFields.filter(
    (newField) =>
      !existingFields.some((existingField) => existingField.id === newField.id),
  ),
];
```

#### Drag and Drop Implementation

```typescript
// Always use unique identifiers
<Draggable
  key={`field-${field.id}`}
  draggableId={`field-${field.id}`}
  index={index}
>

// For nested structures
<Draggable
  key={`${type}-${parentId}-${item.id}-${index}`}
  draggableId={`${type}-${parentId}-${item.id}-${index}`}
  index={index}
>

// Handle drops consistently
const handleDragEnd = (result: DropResult) => {
  if (!result.destination || !onReorderFields) return;
  onReorderFields(result.source.index, result.destination.index);
};
```

#### Field Display and Mapping

```typescript
// Map field references to full definitions
const displayFields = fieldRefs
  .map((ref) => {
    const field = fields.find((f) => f.id === ref.id);
    return field ? { ...field, ...ref } : null;
  })
  .filter((f) => f !== null);

// Field removal (reference only)
const handleRemoveField = (fieldId: number) => {
  const updatedFields = stepFields.filter((field) => field.id !== fieldId);
  onAddExistingField(
    step.id,
    updatedFields.map((field) => field.id),
  );
};
```

### Database Operations

#### SQL Queries with Reserved Keywords

```typescript
// ❌ Incorrect - unquoted reserved keywords
const result = await pool.query(
  `UPDATE "${DB_TABLES.FIELDS}" SET primary = $1, order = $2 WHERE id = $3`,
  [true, 1, fieldId],
);

// ✅ Correct - quoted reserved keywords
const result = await pool.query(
  `UPDATE "${DB_TABLES.FIELDS}" SET "primary" = $1, "order" = $2 WHERE id = $3`,
  [true, 1, fieldId],
);
```

#### Case Creation and Updates

```typescript
// Initial creation
const createResponse = await fetch("/api/database?table=cases", {
  method: "POST",
  body: JSON.stringify({
    table: "cases",
    data: {
      name: "Case Name",
      description: "Description",
      model: JSON.stringify(initialModel),
    },
  }),
});

// Subsequent updates
const updateResponse = await fetch(`/api/database?table=cases&id=${caseID}`, {
  method: "PUT",
  body: JSON.stringify({
    table: "cases",
    data: {
      id: caseID,
      name: "Updated Name",
      description: "Updated Description",
      model: JSON.stringify(updatedModel),
    },
  }),
});
```

#### View Creation with Field References

```typescript
// Create view with caseID (required!)
const viewResponse = await fetch("/api/database?table=views", {
  method: "POST",
  body: JSON.stringify({
    table: "views",
    data: {
      name: "ViewName",
      caseID: caseID, // Required!
      model: {
        fields: fieldReferences, // Use field IDs, not names
        layout: { type: "form", columns: 1 },
      },
    },
  }),
});
```

### LLM Response Processing

#### SSE Parsing and Tool Call Extraction

```typescript
// Process SSE format
const lines = chunk.split("\n");
for (const line of lines) {
  if (line.startsWith("data: ")) {
    try {
      const data = JSON.parse(line.slice(6));
      if (data.text) {
        accumulatedText += data.text;
      }
    } catch (_e) {
      console.warn("Failed to parse SSE data:", line);
    }
  }
}

// Extract tool calls from accumulated text
const createCaseMatch = accumulatedText.match(
  /TOOL:\s*createCase\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/,
);

const fieldMatches = accumulatedText.matchAll(
  /TOOL:\s*createField\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/g,
);
```

#### JSON Cleaning for Parsing

```typescript
// Clean JSON string before parsing
const cleanJsonString = jsonString
  .replace(/\n/g, "") // Remove newlines
  .replace(/\s+/g, " ") // Normalize whitespace
  .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to property names
  .replace(/'/g, '"') // Replace single quotes with double quotes
  .replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas
```

## Troubleshooting Guide

### Common Error Messages and Solutions

#### "Missing required fields" (400 error)

**Cause**: Missing `caseID` in view creation request
**Solution**: Always include the case ID from the parent case

```typescript
// ✅ Correct
const viewResponse = await fetch("/api/database?table=views", {
  method: "POST",
  body: JSON.stringify({
    table: "views",
    data: {
      name: "ViewName",
      caseID: caseID, // Required!
      model: { fields: [], layout: { type: "form", columns: 1 } },
    },
  }),
});
```

#### "No createCase tool call found in response"

**Cause**: System prompt not imported correctly or malformed SSE data
**Solution**:

1. Check that `databaseSystemPrompt` is imported from `databasePrompt.ts`
2. Verify SSE parsing is working correctly
3. Log accumulated text for debugging

#### "ReferenceError: jest is not defined"

**Cause**: Test code accidentally included in production files
**Solution**:

1. Remove all `jest` references from production files
2. Move test mocks to `__tests__` directories
3. Use dependency injection for testable code

#### Database Schema Errors

**Cause**: Schema changes not applied to database
**Solution**: Reset database after schema changes

```bash
curl -X POST http://localhost:3100/api/reset-db
```

### Debugging Tips

#### Database Operations

```typescript
// Debug logging for database operations
console.log("=== Making Database Update Request ===");
console.log("Request URL:", requestUrl);
console.log("Request Method:", method);
console.log("Request Body:", {
  ...requestBody,
  model: "Stringified model data (truncated for logging)",
});

if (!response.ok) {
  const errorText = await response.text();
  console.error("=== Database Update Failed ===");
  console.error("Status:", response.status);
  console.error("Error Response:", errorText);
  throw new Error(`Failed to ${operation}: ${response.status} ${errorText}`);
}
```

#### LLM Response Processing

```typescript
// Debug SSE processing
console.log("Processing chunk:", {
  rawChunk: chunk,
  parsedText: accumulatedText,
  toolCallFound: !!createCaseMatch,
});
```

## Development Workflow

### Before Starting Work

1. **Pull latest changes**: `git pull origin main`
2. **Install dependencies**: `pnpm install`
3. **Check database connection**: Verify `.env.local` has correct `DATABASE_URL`
4. **Run tests**: `pnpm test` to ensure everything works

### During Development

1. **Follow naming conventions**: PascalCase for components, camelCase for functions
2. **Use TypeScript strictly**: No `any` types, use `unknown` if uncertain
3. **Test frequently**: Run `pnpm test` after significant changes
4. **Check for linting errors**: Ensure ESLint passes

### Before Committing

1. **Run full test suite**: `pnpm test`
2. **Check linting**: `npm run lint`
3. **Self-review**: Review your changes
4. **Update documentation**: If adding new features

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat(scope): description of changes"

# Push and create PR
git push origin feature/your-feature-name
```

## Common Gotchas and Solutions

### Field Management

- **Problem**: Field properties reset during reordering
- **Solution**: Always preserve existing properties when reordering
- **Problem**: Using field names instead of IDs in references
- **Solution**: Always use field IDs for references

### Database Operations

- **Problem**: SQL errors with reserved keywords
- **Solution**: Always quote `primary` and `order` columns
- **Problem**: String IDs in database operations
- **Solution**: Convert to integers before database calls

### Testing

- **Problem**: Test code in production files
- **Solution**: Keep all test code in `__tests__` directories
- **Problem**: Missing test coverage
- **Solution**: Add tests for new functionality

### LLM Integration

- **Problem**: Duplicate system prompts
- **Solution**: Import from single source in `databasePrompt.ts`
- **Problem**: Malformed JSON in responses
- **Solution**: Clean JSON strings before parsing

## Environment Setup

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:password@ep-something.region.aws.neon.tech/dbname

# Azure OpenAI (if using)
AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
AZURE_OPENAI_DEPLOYMENT=your-deployment-name
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret

# Google Gemini (if using)
GEMINI_API_KEY=your-gemini-api-key
```

### Database Setup

1. Create Neon account at https://neon.tech
2. Create new project and database
3. Copy connection string to `.env.local`
4. Reset database: `curl -X POST http://localhost:3100/api/reset-db`

## Testing Guide

### Test Structure

```
src/app/lib/__tests__/llmUtils.test.ts  # Tests for llmUtils.ts
src/app/api/__tests__/openai.test.ts    # Tests for API routes
src/app/components/__tests__/Modal.test.tsx  # Tests for components
```

### Writing Tests

```typescript
// Example test structure
describe("Field Management", () => {
  it("should preserve field properties during reordering", () => {
    // Test implementation
  });

  it("should handle field addition correctly", () => {
    // Test implementation
  });
});
```

### Test Commands

```bash
pnpm test              # Run all tests
pnpm test:watch        # Run tests in watch mode
pnpm test:coverage     # Generate coverage report
pnpm test -- --verbose # Run with verbose output
```

## Code Review Guidelines

### What to Look For

- [ ] TypeScript errors and `any` types
- [ ] Proper error handling
- [ ] Test coverage for new functionality
- [ ] Database operation safety
- [ ] Field management patterns
- [ ] Performance considerations
- [ ] Security best practices

### Review Process

1. **Checkout the branch**: `git checkout feature/branch-name`
2. **Run tests**: `pnpm test`
3. **Review code**: Look for patterns and potential issues
4. **Provide feedback**: Use clear, constructive comments
5. **Approve or request changes**: Based on review findings

### Common Review Comments

- "Consider using `unknown` instead of `any`"
- "Add error handling for this database operation"
- "This field operation should preserve existing properties"
- "Add test coverage for this new functionality"
- "Consider the performance impact of this change"

---

## Need Help?

- Check the troubleshooting guide above
- Review the detailed examples
- Run tests to identify issues
- Check the `.cursor/rules/.cursorrules` for AI assistant patterns
- Ask for help in team discussions
