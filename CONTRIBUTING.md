# Contributing Guide

This document outlines the key patterns and rules to follow when making changes to the codebase.

## Table of Contents

- [Field Management](#field-management)
  - [Field References vs Field Definitions](#field-references-vs-field-definitions)
  - [Step Type Restrictions](#step-type-restrictions)
  - [Key Rules](#key-rules)
- [Component Patterns](#component-patterns)
  - [Modal Components](#modal-components)
  - [Shared Components](#shared-components)
- [State Management](#state-management)
- [Best Practices](#best-practices)
- [Testing](#testing)
- [Common Gotchas](#common-gotchas)
- [Git Workflow](#git-workflow)
- [Code Review Process](#code-review-process)
- [Development Setup](#development-setup)
- [Model Validation and Data Consistency](#model-validation-and-data-consistency)
  - [Model Structure](#model-structure)
  - [Case Creation and Validation](#case-creation-and-validation)
  - [Key Rules for Model Changes](#key-rules-for-model-changes)
  - [Validation Checklist](#validation-checklist)
  - [Common Pitfalls](#common-pitfalls)
  - [Streaming LLM Responses](#streaming-llm-responses)
  - [Step Type Validation](#step-type-validation)
- [Field Types and Validation](#field-types-and-validation)
- [Case Creation and Update Patterns](#case-creation-and-update-patterns)
  - [Preventing Duplicate Records](#preventing-duplicate-records)
  - [Chat Window Behavior](#chat-window-behavior)
- [Database Schema and ID Handling](#database-schema-and-id-handling)
  - [Database Tables and Schemas](#database-tables-and-schemas)
  - [ID Handling Requirements](#id-handling-requirements)
  - [Common Pitfalls](#common-pitfalls)
  - [Best Practices](#best-practices)
  - [Validation Checklist](#validation-checklist)
  - [Case Sensitivity and Naming Conventions](#case-sensitivity-and-naming-conventions)
- [ID Usage and References](#id-usage-and-references)
- [RESTful API Patterns](#restful-api-patterns)
  - [Request/Response Structure](#request-response-structure)
- [System Prompt Management](#system-prompt-management)
  - [Single Source of Truth](#single-source-of-truth)
  - [JSON Formatting and Model Structure](#json-formatting-and-model-structure)
  - [Model Structure Requirements](#model-structure-requirements)
- [LLM Provider Configuration](#llm-provider-configuration)
  - [Azure OpenAI Configuration](#azure-openai-configuration)
  - [Google Gemini Configuration](#google-gemini-configuration)
  - [Provider Selection](#provider-selection)
  - [API Routes](#api-routes)
  - [Common Pitfalls](#common-pitfalls)

## Field Management

### Field References vs Field Definitions

The application maintains a clear separation between field definitions and field references:

- **Field Definitions** (`Field[]`) are stored in the main fields array and contain the complete field information:

  ```typescript
  interface Field {
    id: number; // Database ID
    name: string; // Display name
    label: string; // Display label
    type: fieldType; // Field type
    primary?: boolean; // Whether it's a primary field
    // ... other field properties
  }
  ```

- **Field References** (`FieldReference[]`) are used in steps/views and only contain reference information:
  ```typescript
  interface FieldReference {
    id: number; // References the field definition's ID
    required?: boolean; // Step-specific requirement
  }
  ```

### Field Operations

1. **Field Reordering vs Adding Fields**

   - When handling drag and drop operations, first determine if it's a reorder or add operation:

   ```typescript
   const isReorder =
     fieldIds.every((fieldId) =>
       existingFields.some((existingField) => existingField.id === fieldId),
     ) && fieldIds.length === existingFields.length;
   ```

   - For reordering (when all fields exist and lengths match):

   ```typescript
   // Preserve existing field properties while updating order
   const reorderedFields = fieldIds.map((fieldId) => ({
     id: fieldId,
     required: existingFields.find((f) => f.id === fieldId)?.required ?? false,
   }));
   ```

   - For adding new fields:

   ```typescript
   // Add new fields while preserving existing ones
   const newFields = fieldIds.map((fieldId) => ({
     id: fieldId,
     required: false,
   }));
   const combinedFields = [
     ...existingFields,
     ...newFields.filter(
       (newField) =>
         !existingFields.some(
           (existingField) => existingField.id === newField.id,
         ),
     ),
   ];
   ```

2. **Drag and Drop Implementation**

   - Always use unique identifiers for draggable items:

   ```typescript
   <Draggable
     key={`field-${field.id}`}
     draggableId={`field-${field.id}`}
     index={index}
   >
   ```

   - Handle drops consistently across the application:

   ```typescript
   const handleDragEnd = (result: DropResult) => {
     if (!result.destination || !onReorderFields) return;
     onReorderFields(result.source.index, result.destination.index);
   };
   ```

   - Maintain field properties during reordering:

   ```typescript
   // When reordering, preserve all field properties
   return {
     ...step,
     fields: reorderedFields.map((fieldId) => ({
       id: fieldId,
       required:
         existingFields.find((f) => f.id === fieldId)?.required ?? false,
       // preserve other field-specific properties
     })),
   };
   ```

3. **Field Property Preservation**

   - Always preserve field properties when reordering
   - Don't reset properties to defaults during reorder operations
   - Only initialize new properties for newly added fields
   - Use the existing field as the source of truth for field properties

### Step Type Restrictions

1. **Field Usage Restrictions**
   - Only steps of type "Collect information" can have fields
   - Attempting to add fields to other step types is not allowed
   - The UI should prevent field operations on non-"Collect information" steps
   - Field operations include: adding, reordering, and modifying fields
   - When changing a step's type from "Collect information" to another type, all fields will be automatically removed
   - Fields cannot be recovered after changing step type, they must be re-added if the step is changed back to "Collect information"

### Key Rules

1. **Deleting Fields**

   - Deleting a field from a step/view should only remove the field reference
   - The field definition should remain in the main fields array
   - Use `onAddExistingField` with filtered field list to update step fields

   ```typescript
   const handleRemoveField = (fieldId: number) => {
     const updatedFields = stepFields.filter((field) => field.id !== fieldId);
     onAddExistingField(
       step.id,
       updatedFields.map((field) => field.id),
     );
   };
   ```

2. **Adding Fields**

   - When adding new fields, first create the field definition
   - Then add a reference to the step/view

   ```typescript
   const newField = await onAddField({
     /* field definition */
   });
   onAddExistingField(stepId, [newField.id]);
   ```

3. **Field Names**

   - Field names must be unique across the entire application
   - Never create multiple fields with the same name
   - Use descriptive and specific names to avoid conflicts
   - When using fields in drag-and-drop contexts, ensure unique keys by combining multiple identifiers:

   ```typescript
   // For fields
   <Draggable
     key={`field-${field.id}`}
     draggableId={`field-${field.id}`}  // draggableId should match key
     index={index}
   >

   // For nested structures (e.g., stages/processes/steps)
   <Draggable
     key={`${type}-${parentId}-${item.id}-${index}`}
     draggableId={`${type}-${parentId}-${item.id}-${index}`}
     index={index}
   >
   ```

4. **Displaying Fields**
   - Always map field references to their full definitions before display
   - Merge reference properties with the field definition
   ```typescript
   const displayFields = fieldRefs
     .map((ref) => {
       const field = fields.find((f) => f.id === ref.id);
       return field ? { ...field, ...ref } : null;
     })
     .filter((f) => f !== null);
   ```

## Component Patterns

### Modal Components

1. **Field Management Modals**

   - Use `AddFieldModal` for consistent field addition UI
   - Support both new field creation and existing field selection
   - Maintain proper button refs for focus management

2. **Configuration Modals**
   - Use `StepForm` for consistent field display and management
   - Support drag-and-drop reordering
   - Implement proper field reference handling

### Shared Components

1. **StepForm**

   - Used for both view configuration and step configuration
   - Handles field display, editing, and reordering
   - Expects full field definitions with reference properties merged

2. **AddFieldModal**
   - Shared between views and steps
   - Handles both new field creation and existing field selection
   - Maintains proper field reference handling

## State Management

1. **Field Updates**

   - Field definitions are updated through `onUpdateField`
   - Field references are updated through `onAddExistingField`
   - Field order is managed through `onFieldsReorder`

2. **Step/View Updates**
   - Changes to field lists should update references, not definitions
   - Maintain proper separation between field definitions and references

## Best Practices

1. **Type Safety**

   - Use proper TypeScript interfaces for field and reference types
   - Implement type guards when filtering/mapping fields
   - Maintain proper prop types for components

2. **Performance**

   - Use `useMemo` for expensive field mappings
   - Implement proper dependency arrays for hooks
   - Avoid unnecessary re-renders

3. **Accessibility**

   - Maintain proper focus management in modals
   - Implement proper ARIA attributes
   - Support keyboard navigation

4. **Code Organization**
   - Keep field management logic consistent across components
   - Share common components between similar features
   - Document complex field management patterns

## Testing

When implementing or modifying field management:

1. **Field Operations**

   - Test field addition to steps/views
   - Verify field removal only affects references
   - Confirm field reordering maintains proper references

2. **Data Integrity**

   - Verify field definitions remain intact
   - Confirm reference updates don't affect other steps/views
   - Test proper merge of reference properties

3. **UI Behavior**

   - Test modal open/close behavior
   - Verify drag-and-drop functionality
   - Confirm proper field display and editing

---

### LLM/Database API Regression Rule

**Whenever you make changes to any of the following files or modules:**

- `src/app/lib/llmTools.ts`
- `src/app/lib/llmUtils.ts`
- `src/app/lib/databasePrompt.ts`
- Any API route (e.g., `src/app/api/openai/route.ts`, `src/app/api/gemini/route.ts`)

**You MUST run the full unit and integration test suite (`npm test`) before submitting or merging your changes.**

- This ensures that no regressions are introduced to LLM tool handling, prompt logic, or API route behavior.
- If any test fails, you must fix the failure before submitting your code.
- Add or update tests as needed to cover new or changed logic.

---

## Common Gotchas

1. **Field Deletion**

   - Don't use `onDeleteField` in step/view components
   - Only use it in field management interfaces
   - Always use reference updates instead

2. **Field Updates**

   - Don't modify field definitions when updating step/view fields
   - Always maintain proper separation of concerns
   - Use appropriate update methods for each case

3. **Component Reuse**
   - Don't duplicate field management logic
   - Use shared components consistently
   - Maintain proper prop interfaces

## Git Workflow

### Branch Naming

- Feature branches: `feature/description-of-feature`
- Bug fixes: `fix/description-of-bug`
- Documentation: `docs/what-is-being-documented`
- Performance improvements: `perf/what-is-being-optimized`

### Commit Messages

- Use conventional commits format: `type(scope): description`
- Types: feat, fix, docs, style, refactor, test, chore
- Keep messages clear and concise
- Reference issue numbers when applicable

### Pull Requests

- Create descriptive PR titles
- Fill out the PR template completely
- Link related issues
- Add appropriate labels
- Request reviews from relevant team members

## Code Review Process

### Before Requesting Review

- Run all tests locally
- Update documentation if needed
- Ensure code follows style guidelines
- Self-review your changes
- Add meaningful test coverage

### Review Guidelines

- Respond to reviews within 24 hours
- Use "Request Changes" for blocking issues
- Use "Comment" for non-blocking suggestions
- Approve only when all concerns are addressed

## Development Setup

### Prerequisites

- Node.js (version specified in .nvmrc)
- pnpm (preferred package manager)
- Git
- Neon PostgresDB account and database instance

### Database Setup

1. **Neon PostgresDB**

   - The application uses Neon PostgresDB as its primary database
   - Create a Neon account at https://neon.tech if you don't have one
   - Create a new project and database instance
   - Copy the connection string from your Neon dashboard
   - Add the connection string to your `.env.local` file:
     ```
     DATABASE_URL=postgres://user:password@ep-something.region.aws.neon.tech/dbname
     ```

2. **Database Schema**

   - The application uses the following tables:
     - `Cases`: Stores workflow definitions
     - `Fields`: Stores field definitions for cases
     - `Views`: Stores view configurations for cases
   - All table names are case-sensitive and use double quotes
   - Follow PostgreSQL naming conventions for new tables/columns

3. **Database Operations**
   - Use the `pg` package for all database operations
   - Always use parameterized queries to prevent SQL injection
   - Handle database errors appropriately
   - Use transactions for operations that modify multiple tables

### Getting Started

1. Clone the repository
2. Run `pnpm install`
3. Copy `.env.example` to `.env.local`
4. Run `pnpm dev` to start development server

### IDE Setup

- Install recommended VS Code extensions
- Use provided workspace settings
- Enable TypeScript strict mode
- Configure ESLint and Prettier integrations

### Running Tests

- Unit tests: `pnpm test`
- E2E tests: `pnpm test:e2e`
- Coverage report: `pnpm test:coverage`

### After making any changes to the database schema (e.g., modifying table structure, adding/removing columns, changing constraints), **you must reset the database** to apply the new schema. To do this, send a POST request to `/api/reset-db` (e.g., using curl: `curl -X POST http://localhost:3100/api/reset-db`). This will drop all tables and recreate them with the latest schema. **All data will be lost.**

## Model Validation and Data Consistency

### Gemini Model Configuration

1. **Model Name and Configuration**

   - The application uses `gemini-2.0-flash-001` as the model name
   - This is the correct model name and should not be changed to other variants
   - The configuration must include:
     ```typescript
     const generativeModel = genAI.getGenerativeModel({
       model: "gemini-2.0-flash-001",
       generationConfig: {
         maxOutputTokens: 8192,
       },
     });
     ```
   - Do not change this to `gemini-1.0-pro` or any other model name
   - The model name is case-sensitive and must be exactly as specified

2. **Common Mistakes to Avoid**
   - Do not change the model name to `gemini-1.0-pro`
   - Do not remove the `generationConfig` settings
   - Do not modify the `maxOutputTokens` value
   - Always use the exact model name: `gemini-2.0-flash-001`

### Streaming LLM Responses

1. **Server-Sent Events (SSE) Format**

   - The application uses Server-Sent Events to stream LLM responses
   - This provides immediate feedback to users and shows the AI's thinking process
   - SSE format:
     ```
     data: {"text": "chunk of response"}
     data: {"text": "next chunk"}
     data: {"done": true}
     ```

2. **Response Processing**

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
   ```

3. **Tool Call Extraction**

   - Tool calls are extracted from the accumulated text
   - Pattern matching is done on the complete response
   - Example patterns:

     ```typescript
     // Look for createCase tool call
     const createCaseMatch = accumulatedText.match(
       /TOOL:\s*createCase\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/,
     );

     // Look for createField tool calls
     const fieldMatches = accumulatedText.matchAll(
       /TOOL:\s*createField\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/g,
     );

     // Look for createView tool calls
     const viewMatches = accumulatedText.matchAll(
       /TOOL:\s*createView\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/g,
     );
     ```

4. **Common Pitfalls to Avoid**

   - ❌ Don't search for tool calls in raw SSE data
   - ❌ Don't accumulate raw SSE messages
   - ❌ Don't ignore SSE parsing errors
   - ✅ Always parse SSE data first
   - ✅ Extract only text content
   - ✅ Handle parsing errors gracefully
   - ✅ Log parsing failures for debugging

5. **Implementation Checklist**

   - [ ] Parse SSE data before tool call detection
   - [ ] Extract text content from SSE messages
   - [ ] Handle SSE parsing errors
   - [ ] Use correct regex patterns for tool calls
   - [ ] Log parsing failures
   - [ ] Test with various response formats

6. **Error Handling**

   - Graceful handling of malformed SSE data
   - Proper accumulation of text chunks
   - Validation of tool calls in complete response
   - Clear error messages for missing or invalid tool calls
   - Example error handling:
     ```typescript
     if (!createCaseMatch) {
       console.error(
         "No createCase tool call found in response. Full response:",
         accumulatedText,
       );
       throw new Error("No createCase tool call found in response");
     }
     ```

7. **Testing Requirements**

   - Test SSE parsing with various chunk sizes
   - Test tool call detection with different formats
   - Test error handling for malformed data
   - Test with multiple tool calls in one response
   - Test with tool calls split across chunks

8. **Debugging Tips**

   - Log raw SSE chunks for debugging
   - Log parsed text content
   - Log tool call detection attempts
   - Log accumulated text before tool call search
   - Example debugging:
     ```typescript
     console.log("Processing chunk:", {
       rawChunk: chunk,
       parsedText: accumulatedText,
       toolCallFound: !!createCaseMatch,
     });
     ```

### Model Structure

The workflow model follows a strict structure that must be maintained across all parts of the application:

```typescript
interface WorkflowModel {
  name: string;
  stages: Stage[];
  fields: Field[];
  // Add new model properties here
}
```

### Case Creation and Validation

1. **Case ID vs Name**

   - Each case has a unique numeric ID (auto-generated by the database) and a name
   - The ID is used for database operations (deletion, updates)
   - The name is used for display and user interaction
   - Case names do NOT need to be unique - multiple cases can have the same name
   - When deleting a case:

     ```typescript
     // Find the case by name to get its ID
     const caseToDelete = cases.find((c) => c.name === name);
     if (!caseToDelete) {
       throw new Error("Workflow not found");
     }

     // Use the numeric ID for database operations
     const response = await fetch(
       `/api/database?table=cases&id=${caseToDelete.id}`,
       {
         method: "DELETE",
       },
     );
     ```

2. **Case Name Uniqueness**

   - Case names do NOT need to be unique across the application
   - Multiple cases can have the same name
   - The system uses numeric IDs for all operations
   - Example:

   ```typescript
   // ✅ Valid - Multiple cases can have the same name
   const case1 = {
     id: 1,
     name: "Home Construction",
     description: "First home construction workflow",
   };
   const case2 = {
     id: 2,
     name: "Home Construction",
     description: "Second home construction workflow",
   };
   ```

3. **Model Generation**

   - The Gemini API response may include multiple tool calls (createCase, createField, createView)
   - Only process the createCase tool call, ignore others
   - Extract and validate the model structure from the createCase parameters
   - Map step types to valid values:

   ```typescript
   const stepTypeMap: { [key: string]: string } = {
     "Collect information": "collect_information",
     "Approve/Reject": "decision",
     Automation: "notification",
     "Create Case": "notification",
     Decision: "decision",
     "Generate Document": "notification",
     "Generative AI": "notification",
     "Robotic Automation": "notification",
     "Send Notification": "notification",
   };
   ```

4. **Model Validation**

   - The model must include a `stages` array, but it can be empty
   - Empty stages array is valid: `{ stages: [] }`
   - Missing stages array is invalid: `{ stages: null }` or `{ stages: undefined }`
   - Example:

   ```typescript
   // ✅ Valid - Empty stages array
   const model = {
     stages: [],
   };

   // ✅ Valid - Stages with content
   const model = {
     stages: [
       {
         id: "stage1",
         name: "Planning",
         order: 1,
         processes: [],
       },
     ],
   };

   // ❌ Invalid - Missing stages array
   const model = {
     stages: null,
   };
   ```

5. **View ID Generation**

   - Each collect_information step must have a unique viewId
   - Generate view IDs sequentially (view1, view2, etc.)
   - Map view IDs to step names to maintain consistency
   - Validate that all collect_information steps have a viewId

6. **Model Validation Checklist**

   - [ ] Model has stages array (can be empty)
   - [ ] Each stage has processes array
   - [ ] Each process has steps array
   - [ ] Each step has type and name
   - [ ] Step types are valid (collect_information, decision, notification)
   - [ ] Collect information steps have viewId
   - [ ] All IDs are properly formatted (stage1, process1_1, step1_1_1)

7. **Error Handling**
   - Provide clear error messages for validation failures
   - Log validation steps for debugging
   - Handle JSON parsing errors gracefully
   - Clean up JSON strings before parsing:
     ```typescript
     const jsonStr = createCaseMatch[1]
       .replace(/\n/g, "") // Remove newlines
       .replace(/\s+/g, " ") // Normalize whitespace
       .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to property names
       .replace(/'/g, '"'); // Replace single quotes with double quotes
     ```

### Key Rules for Model Changes

1. **Adding New Model Properties**

   - When adding a new property to the model, update ALL of the following:
     - TypeScript interfaces in `src/app/types.ts`
     - API route validation in both `src/app/api/gemini/route.ts` and `src/app/api/openai/route.ts`
     - Session storage handling in `src/app/page.tsx`
     - AI system prompt in `src/app/services/service.ts`
     - Initial state loading and state management

2. **API Route Validation**

   - All API routes must implement consistent validation:

   ```typescript
   // Example validation in API routes
   if (!parsed.model || (!parsed.model.stages && !parsed.model.fields)) {
     throw new Error("Response missing required model data");
   }

   const validatedResponse = {
     message: parsed.message || "",
     model: {
       name: parsed.model.name || "",
       stages: Array.isArray(parsed.model.stages) ? parsed.model.stages : [],
       fields: Array.isArray(parsed.model.fields) ? parsed.model.fields : [],
       // Add validation for new properties here
     },
     // ... other response properties
   };
   ```

3. **State Management**

   - Each model property should have corresponding state management:

   ```typescript
   const [workflowName, setWorkflowName] = useState<string>("");
   const [stages, setStages] = useState<Stage[]>([]);
   const [fields, setFields] = useState<Field[]>([]);
   // Add state for new properties here
   ```

4. **AI System Prompt**
   - Update the system prompt to include any new model properties:
   ```typescript
   private static readonly SYSTEM_MESSAGE = `
     // ... existing prompt ...
     The workflow model follows a strict structure:
     {
       "name": "descriptive workflow name",
       "stages": [...],
       "fields": [...],
       // Document new properties here
     }
   `;
   ```

### Validation Checklist

When adding new model properties, use this checklist:

- [ ] Added TypeScript interface in `types.ts`
- [ ] Updated API route validation in both Gemini and OpenAI routes
- [ ] Added session storage handling
- [ ] Updated AI system prompt
- [ ] Added state management
- [ ] Updated default model
- [ ] Added validation in relevant components
- [ ] Updated tests to cover new properties
- [ ] Updated documentation

### Common Pitfalls

1. **Incomplete Validation**

   - Always validate ALL properties in API routes
   - Don't assume properties exist, provide fallbacks
   - Use TypeScript to catch missing properties

2. **Inconsistent Storage**

   - Always update both memory state and session storage
   - Load all properties during initialization
   - Handle missing storage values gracefully

3. **Missing AI Updates**
   - Ensure AI responses include all model properties
   - Update system prompt to document new properties
   - Test AI responses with new properties

### Step Type Validation

1. **Valid Step Types**

   - The application supports the following step types:
     ```typescript
     const stepTypeMap: { [key: string]: string } = {
       "Collect information": "collect_information",
       "Approve/Reject": "decision",
       "Generate Document": "notification",
       "Create Case": "notification",
       Decision: "decision",
       Automation: "notification",
       "Send Notification": "notification",
       "Robotic Automation": "notification",
       "Generative AI": "notification",
     };
     ```

2. **Step Type Requirements**

   - Each step type has specific requirements:
     - `collect_information` steps must have a `viewId` property
     - `viewId` must be unique across all steps
     - `viewId` format should be `view1`, `view2`, etc.
     - Example:
       ```typescript
       {
         "id": "step1",
         "type": "collect_information",
         "name": "Client Requirements",
         "order": 1,
         "viewId": "view1"  // Required for collect_information steps
       }
       ```

3. **View ID Generation**

   - View IDs are generated automatically for collect_information steps
   - Generation process:

     ```typescript
     // First pass: count and map collect_information steps
     let viewCounter = 1;
     const viewIdMap = new Map<string, string>();

     // Second pass: assign viewIds
     if (step.type === "collect_information") {
       step.viewId = viewIdMap.get(step.name) || `view${viewCounter++}`;
     }
     ```

4. **Common Pitfalls**

   - Missing `viewId` for collect_information steps will result in a 400 error
   - Duplicate `viewId` values are not allowed
   - Non-collect_information steps should not have a `viewId`
   - Always validate step types and their requirements before saving

### Case, Field, and View Relationships

1. **Case Structure**

   - Each case has:
     - A unique ID (auto-generated by the database)
     - A unique name
     - A list of fields (references to the fields table)
     - A list of views (references to the views table)
     - A model containing stages, processes, and steps

2. **Field Relationships**

   - Fields are created first and linked to a case using `caseID`
   - Each field has:
     - A unique ID (auto-generated by the database)
     - A name (unique within the case)
     - A type (Text, Date, Address, etc.)
     - A reference to its parent case (`caseID`)

3. **View Relationships**

   - Views are created after fields and linked to a case using `caseID`
   - Each view has:
     - A unique ID (auto-generated by the database)
     - A name (unique within the case)
     - A reference to its parent case (`caseID`)
     - A model containing field references
   - Views can only reference fields that exist in their parent case
   - Field references in views use field IDs, not names

4. **Step and View Relationships**

   - Steps of type `collect_information` must reference a view
   - The view reference uses the view's ID, not its name
   - The referenced view must exist in the same case
   - Example:
     ```typescript
     {
       "id": "step1",
       "type": "collect_information",
       "name": "Client Requirements",
       "viewId": "123"  // References a view ID in the database
     }
     ```

5. **Creation Order**

   The correct order for creating a case with its relationships is:

   1. Create the case to get its ID
   2. Create all fields for the case
   3. Create all views for the case (referencing field IDs)
   4. Update steps to reference view IDs
   5. Update the case with the final model

6. **Validation Rules**

   - All field references in views must exist in the case
   - All view references in steps must exist in the case
   - Field names must be unique within a case
   - View names must be unique within a case
   - Steps of type `collect_information` must have a valid view reference

7. **Common Pitfalls**

   - Using field names instead of IDs in view references
   - Using view names instead of IDs in step references
   - Creating views before fields
   - Not validating field existence before creating views
   - Not updating step references after view creation

## Case Creation and Update Patterns

### Preventing Duplicate Records

1. **Case Creation Flow**

   - Always use POST for initial case creation
   - Use PUT for subsequent updates to the same case
   - Include case ID in the URL for updates: `/api/database?table=cases&id=${caseID}`
   - Example:

     ```typescript
     // Initial creation
     const createResponse = await fetch("/api/database?table=cases", {
       method: "POST",
       body: JSON.stringify({
         table: "cases",
         data: {
           name: "Case Name",
           description: "Description",
           model: initialModel,
         },
       }),
     });

     // Subsequent updates
     const updateResponse = await fetch(
       `/api/database?table=cases&id=${caseID}`,
       {
         method: "PUT",
         body: JSON.stringify({
           table: "cases",
           data: {
             id: caseID,
             name: "Updated Name",
             description: "Updated Description",
             model: updatedModel,
           },
         }),
       },
     );
     ```

2. **Field and View Creation**

   - Fields must be created before views
   - Views must include the caseID in their creation request
   - Field references in views must use field IDs, not names
   - Example:

     ```typescript
     // Create field
     const fieldResponse = await fetch("/api/database?table=fields", {
       method: "POST",
       body: JSON.stringify({
         table: "fields",
         data: {
           name: "fieldName",
           type: "Text",
           caseID: caseID,
           primary: false,
           required: true,
           label: "Field Label",
           description: "Field Description",
           order: 1,
           options: [],
           defaultValue: null,
         },
       }),
     });

     // Create view
     const viewResponse = await fetch("/api/database?table=views", {
       method: "POST",
       body: JSON.stringify({
         table: "views",
         data: {
           name: "ViewName",
           caseID: caseID, // Required!
           model: {
             fields: [],
             layout: { type: "form", columns: 1 },
           },
         },
       }),
     });
     ```

3. **Step and View Relationships**

   - Steps of type "collect_information" must have a viewId
   - ViewId must reference an existing view in the same case
   - View names should follow the pattern: `${stepName}Form`
   - Example:
     ```typescript
     {
       "id": "step1",
       "type": "collect_information",
       "name": "Client Requirements",
       "viewId": "view123", // Must reference an existing view
       "order": 1
     }
     ```

4. **Creation Order**
   The correct order for creating a case with its relationships is:

   1. Create the case to get its ID
   2. Create all fields for the case
   3. Create all views for the case (referencing field IDs)
   4. Update steps to reference view IDs
   5. Update the case with the final model

5. **Common Pitfalls to Avoid**

   - Using POST instead of PUT for case updates
   - Missing caseID in view creation requests
   - Creating views before fields
   - Using field names instead of IDs in view references
   - Not updating step references after view creation
   - Not including all required fields in creation requests

6. **Validation Checklist**

   - [ ] Case creation uses POST
   - [ ] Case updates use PUT with caseID in URL
   - [ ] All fields include required properties
   - [ ] Views include caseID in creation request
   - [ ] Field references in views use IDs
   - [ ] Steps reference existing views
   - [ ] View names follow the naming pattern
   - [ ] Creation order is followed correctly

7. **Error Handling**
   - Always check response status
   - Log detailed error messages
   - Include error context in thrown errors
   - Example:
     ```typescript
     if (!response.ok) {
       const errorText = await response.text();
       console.error("Failed to create/update. Status:", response.status);
       console.error("Error response:", errorText);
       throw new Error(`Failed: ${response.status} ${errorText}`);
     }
     ```

### Chat Window Behavior

1. **Current Case Modification Only**

   - The chat window should ONLY modify the currently opened case
   - NEVER create a new case through the chat window
   - Always use the existing case's ID for all modifications
   - Example:

     ```typescript
     // ❌ Incorrect - Don't create new cases in chat
     const createCaseMatch = accumulatedText.match(
       /TOOL:\s*createCase\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/,
     );

     // ✅ Correct - Only modify existing case
     const updateCaseMatch = accumulatedText.match(
       /TOOL:\s*updateCase\s+PARAMS:\s*({[\s\S]*?})\s*(?:\n|$)/,
     );
     ```

2. **Case Update Pattern**

   - Always use PUT for case updates
   - Include the current case ID in the URL
   - Preserve existing case properties
   - Example:

     ```typescript
     // Update existing case
     const updateResponse = await fetch(
       `/api/database?table=${DB_TABLES.CASES}&id=${currentCaseId}`,
       {
         method: "PUT",
         body: JSON.stringify({
           table: DB_TABLES.CASES,
           data: {
             id: currentCaseId,
             name: currentCase.name,
             description: currentCase.description,
             model: JSON.stringify(updatedModel),
           },
         }),
       },
     );
     ```

3. **Common Pitfalls**

   - ❌ Don't create new cases in the chat window
   - ❌ Don't use POST for case updates
   - ❌ Don't omit the case ID in update requests
   - ✅ Always use PUT for updates
   - ✅ Always include the current case ID
   - ✅ Preserve existing case properties

4. **Implementation Checklist**

   - [ ] Verify current case ID is available
   - [ ] Use PUT method for updates
   - [ ] Include case ID in request URL
   - [ ] Preserve existing case properties
   - [ ] Handle update errors appropriately
   - [ ] Update local state after successful update

5. **Error Handling**

   - Check for current case ID before updates
   - Handle missing case ID gracefully
   - Provide clear error messages
   - Example:

     ```typescript
     if (!currentCaseId) {
       throw new Error("No case ID available for update");
     }

     try {
       const response = await fetch(
         `/api/database?table=${DB_TABLES.CASES}&id=${currentCaseId}`,
         {
           method: "PUT",
           // ... request body
         },
       );

       if (!response.ok) {
         const errorText = await response.text();
         throw new Error(
           `Failed to update case: ${response.status} ${errorText}`,
         );
       }
     } catch (error) {
       console.error("Error updating case:", error);
       throw error;
     }
     ```

## Field Types and Validation

1. **Valid Field Types**

   - The application supports the following field types and their database mappings:
     ```typescript
     const fieldTypeMap: { [key: string]: string } = {
       Text: "text", // General text input
       Address: "text", // Address stored as text
       Email: "text", // Email stored as text
       Date: "date", // Date input
       DateTime: "date", // DateTime stored as date
       Status: "text", // Status stored as text
       Currency: "text", // Currency stored as text
       Checkbox: "boolean", // Boolean checkbox
     };
     ```

2. **Required Field Properties**

   - All fields must include these properties:
     ```typescript
     {
       id: number;        // Unique field ID
       name: string;      // Unique field name
       type: string;      // Field type (mapped to database type)
       caseID: number;    // Numeric ID of parent case
       primary: boolean;  // Whether it's a primary field
       required: boolean; // Whether the field is required
       label: string;     // Display label
       description: string; // Field description
       order: number;     // Display order
       options: any[];    // Field options (if applicable)
       defaultValue: any;  // Default value
     }
     ```

3. **Field Creation Example**

   ```typescript
   {
     id: 123,
     name: "projectName",
     type: "Text",          // Will be mapped to "text"
     caseID: 123,           // Numeric ID from database
     primary: true,
     required: true,
     label: "Project Name",
     description: "Name of the construction project",
     order: 1,
     options: [],
     defaultValue: null
   }
   ```

4. **Common Pitfalls**

   - Missing required fields will result in a 400 error
   - Using unmapped field types
   - Using string caseID instead of numeric ID
   - Not providing all required properties
   - Using incorrect data types for properties

### Step Types and View IDs

1. **Step Type Requirements**

   - Each step must have a valid type from the following list:
     ```typescript
     const stepTypeMap: { [key: string]: string } = {
       "Collect information": "collect_information",
       "Approve/Reject": "decision",
       "Generate Document": "notification",
       "Create Case": "notification",
       Decision: "decision",
       Automation: "notification",
       "Send Notification": "notification",
       "Robotic Automation": "notification",
       "Generative AI": "notification",
     };
     ```

2. **View ID Requirements**

   - Steps of type "Collect information" MUST have a viewId property
   - View IDs must be unique across all steps
   - View IDs must be assigned BEFORE creating the case
   - View ID format should be "view1", "view2", etc.
   - Example:
     ```typescript
     {
       "id": "step1",
       "type": "collect_information",
       "name": "Client Requirements",
       "order": 1,
       "viewId": "view1"  // Required for collect_information steps
     }
     ```

3. **View ID Generation Process**

   - Use a two-pass system:
     1. First pass: Count and generate view IDs
     2. Second pass: Assign view IDs to steps
   - Example implementation:

     ```typescript
     // First pass: Generate view IDs
     let viewCounter = 1;
     const viewIdMap = new Map<string, string>();

     model.stages.forEach((stage) => {
       stage.processes.forEach((process) => {
         process.steps.forEach((step) => {
           if (step.type === "Collect information") {
             const viewId = `view${viewCounter++}`;
             viewIdMap.set(step.name, viewId);
           }
         });
       });
     });

     // Second pass: Assign view IDs
     model.stages.forEach((stage) => {
       stage.processes.forEach((process) => {
         process.steps.forEach((step) => {
           if (step.type === "collect_information") {
             const viewId = viewIdMap.get(step.name);
             if (!viewId) {
               throw new Error(`No viewId found for step: ${step.name}`);
             }
             step.viewId = viewId;
           }
         });
       });
     });
     ```

4. **View Creation and Mapping**

   - Views must be created after the case is created
   - Views must be linked to the case using the case's ID
   - View names should follow the pattern: `${stepName}Form`
   - Example:

     ```typescript
     // Create view
     const viewResponse = await fetch("/api/database?table=views", {
       method: "POST",
       body: JSON.stringify({
         table: "views",
         data: {
           name: "ProjectRequirementsForm",
           caseID: caseID,
           model: {
             fields: [...],
             layout: { type: "form", columns: 1 }
           }
         }
       })
     });

     // Map view to its ID
     const viewData = await viewResponse.json();
     createdViewIdMap.set("ProjectRequirementsForm", viewData.id);
     ```

5. **Common Pitfalls**

   - Missing viewId for "Collect information" steps
   - Using incorrect step type values
   - Not generating view IDs before case creation
   - Not mapping view IDs after view creation
   - Using inconsistent view naming patterns
   - Not handling view ID assignment errors

6. **Validation Checklist**

   - [ ] All "Collect information" steps have a viewId
   - [ ] View IDs are unique across all steps
   - [ ] Step types are valid and properly mapped
   - [ ] Views are created with correct case IDs
   - [ ] View names follow the naming pattern
   - [ ] View IDs are properly mapped after creation
   - [ ] Error handling is in place for missing view IDs

7. **Best Practices**

   - Always use the two-pass system for view ID generation
   - Validate step types before creating the case
   - Use consistent naming patterns for views
   - Implement proper error handling
   - Log warnings for unknown step types
   - Keep view ID generation and assignment separate
   - Use TypeScript for type safety

### View Creation Requirements

1. **Required Fields for View Creation**

   ```typescript
   {
     name: string;        // Required: Unique view name
     caseID: number;      // Required: Numeric ID of parent case
     model: {            // Required: View model
       fields: FieldReference[];  // Array of field references
       layout: {         // Required: Layout configuration
         type: string;   // Layout type (e.g., "form")
         columns: number; // Number of columns
       }
     }
   }
   ```

2. **Common View Creation Errors**

   - "Missing required fields" (400 error)

     - Cause: Missing `caseID` in view creation request
     - Solution: Always include the case ID from the parent case

     ```typescript
     // ❌ Incorrect - Missing caseID
     const viewResponse = await fetch("/api/database?table=views", {
       method: "POST",
       body: JSON.stringify({
         table: "views",
         data: {
           name: "ViewName",
           model: { fields: [], layout: { type: "form", columns: 1 } },
         },
       }),
     });

     // ✅ Correct - Includes caseID
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

3. **View Creation Checklist**

   - [ ] Case has been created and ID is available
   - [ ] View name follows the pattern `${stepName}Form`
   - [ ] `caseID` is included in the view creation request
   - [ ] Model includes required layout configuration
   - [ ] Field references use field IDs, not names

4. **Troubleshooting View Creation**

   ```typescript
   // Debug logging for view creation
   console.log("Creating view with data:", {
     name: viewName,
     caseID: caseID,
     model: viewModel,
   });

   const viewResponse = await fetch("/api/database?table=views", {
     method: "POST",
     body: JSON.stringify({
       table: "views",
       data: {
         name: viewName,
         caseID: caseID,
         model: viewModel,
       },
     }),
   });

   if (!viewResponse.ok) {
     const errorText = await viewResponse.text();
     console.error("View creation failed:", {
       status: viewResponse.status,
       error: errorText,
       requestData: {
         name: viewName,
         caseID: caseID,
         model: viewModel,
       },
     });
     throw new Error(
       `Failed to create view: ${viewResponse.status} ${errorText}`,
     );
   }
   ```

5. **View Creation Flow**

   ```typescript
   // 1. Create case first
   const caseResponse = await fetch("/api/database?table=cases", {
     method: "POST",
     body: JSON.stringify({
       table: "cases",
       data: {
         name: "Case Name",
         description: "Description",
         model: initialModel,
       },
     }),
   });
   const caseData = await caseResponse.json();
   const caseID = caseData.id;

   // 2. Create fields
   const fieldResponse = await fetch("/api/database?table=fields", {
     method: "POST",
     body: JSON.stringify({
       table: "fields",
       data: {
         name: "fieldName",
         type: "Text",
         caseID: caseID, // Include caseID
       },
     }),
   });

   // 3. Create view with caseID
   const viewResponse = await fetch("/api/database?table=views", {
     method: "POST",
     body: JSON.stringify({
       table: "views",
       data: {
         name: "ViewName",
         caseID: caseID, // Required!
         model: {
           fields: [],
           layout: { type: "form", columns: 1 },
         },
       },
     }),
   });

   // 4. Update case with view references
   const updateResponse = await fetch(
     `/api/database?table=cases&id=${caseID}`,
     {
       method: "PUT",
       body: JSON.stringify({
         table: "cases",
         data: {
           id: caseID,
           name: "Case Name",
           description: "Description",
           model: updatedModel,
         },
       }),
     },
   );
   ```

## Database Schema and ID Handling

### Database Tables and Schemas

1. **Cases Table**

   ```sql
   CREATE TABLE "Cases" (
     id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
     name TEXT UNIQUE NOT NULL,
     description VARCHAR(500) NOT NULL,
     model TEXT,
     CONSTRAINT Cases_pkey PRIMARY KEY (id),
     CONSTRAINT cases_name_unique UNIQUE (name)
   );

   CREATE UNIQUE INDEX Cases_pkey ON "Cases" USING BTREE (id);
   CREATE UNIQUE INDEX cases_name_unique ON "Cases" USING BTREE (name);
   ```

2. **Fields Table**

   ```sql
   CREATE TABLE "Fields" (
     id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
     type TEXT NOT NULL,
     name TEXT NOT NULL,
     "primary" BOOLEAN NOT NULL DEFAULT false,
     caseID INTEGER NOT NULL,
     label TEXT NOT NULL,
     description TEXT NOT NULL DEFAULT '',
     "order" INTEGER NOT NULL DEFAULT 0,
     options TEXT NOT NULL DEFAULT '[]',
     required BOOLEAN NOT NULL DEFAULT false,
     CONSTRAINT fields_name_caseid_unique UNIQUE (name, caseID),
     CONSTRAINT fields_caseid_fkey FOREIGN KEY (caseID) REFERENCES "Cases" (id)
   );

   CREATE INDEX fields_caseid_idx ON "Fields" (caseID);
   ```

3. **Views Table**

   ```sql
   CREATE TABLE "Views" (
     id INTEGER PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
     name TEXT,
     model TEXT,
     caseID INTEGER,
     CONSTRAINT Views_pkey PRIMARY KEY (id)
   );

   CREATE UNIQUE INDEX Views_pkey ON "Views" USING BTREE (id);
   ```

### ID Handling Requirements

1. **All IDs are Integers**

   - Primary keys are auto-generated integers
   - Foreign keys must be integers
   - Never use string IDs in database operations
   - Convert string IDs to integers before database operations

2. **Case ID Handling**

   ```typescript
   // Convert case ID to integer when received from database
   const caseID = parseInt(caseData.data.id);

   // Use integer caseID in all database operations
   const fieldResponse = await fetch("/api/database?table=fields", {
     method: "POST",
     body: JSON.stringify({
       table: "fields",
       data: {
         name: fieldName,
         type: fieldType,
         primary: false,
         caseID: caseID, // Use integer caseID
       },
     }),
   });
   ```

3. **View ID Handling**

   ```typescript
   // Store view IDs as strings in memory
   const createdViewIdMap = new Map<string, string>();

   // Convert view ID to string when storing in memory
   createdViewIdMap.set(viewName, viewData.data.id.toString());

   // Use integer IDs in database operations
   const viewResponse = await fetch("/api/database?table=views", {
     method: "POST",
     body: JSON.stringify({
       table: "views",
       data: {
         name: viewName,
         caseID: parseInt(caseID),
         model: JSON.stringify(model),
       },
     }),
   });
   ```

4. **Model Storage**
   - Case model must be stringified before storage
   - View model must be stringified before storage
   - Example:
     ```typescript
     // Stringify model before storing
     const caseResponse = await fetch("/api/database?table=cases", {
       method: "POST",
       body: JSON.stringify({
         table: "cases",
         data: {
           name: name,
           description: description,
           model: JSON.stringify(model),
         },
       }),
     });
     ```

### Case Sensitivity and Naming Conventions

1. **Table Names**

   - All table names are case-sensitive and must use double quotes
   - Use the exact table names as defined in `DB_TABLES`:
     ```typescript
     const DB_TABLES = {
       CASES: "Cases",
       FIELDS: "Fields",
       VIEWS: "Views",
     };
     ```
   - Never use lowercase table names in API calls
   - Example:

     ```typescript
     // ❌ Incorrect
     fetch("/api/database?table=cases");

     // ✅ Correct
     fetch(`/api/database?table=${DB_TABLES.CASES}`);
     ```

2. **Column Names**

   - Column names in the database are case-sensitive
   - Use exact column names as defined in `DB_COLUMNS`:
     ```typescript
     const DB_COLUMNS = {
       CASE_ID: "caseID",
       // ... other columns
     };
     ```
   - Common column names:
     - `caseID` (not `caseID`)
     - `id` (not `ID`)
     - `name` (not `Name`)
     - `type` (not `Type`)

3. **API Parameters**

   - Use consistent casing in API parameters
   - Table names must match `DB_TABLES`
   - Column names must match `DB_COLUMNS`
   - Example:

     ```typescript
     // ❌ Incorrect
     fetch(`/api/database?table=fields&caseID=${id}`);

     // ✅ Correct
     fetch(
       `/api/database?table=${DB_TABLES.FIELDS}&${DB_COLUMNS.CASE_ID}=${id}`,
     );
     ```

4. **Type Definitions**

   - Use consistent casing in TypeScript interfaces
   - Match database column names exactly
   - Example:

     ```typescript
     // ❌ Incorrect
     interface Field {
       caseID: number;
     }

     // ✅ Correct
     interface Field {
       caseID: number;
     }
     ```

5. **Common Pitfalls**

   - Using lowercase table names in API calls
   - Inconsistent casing between database and code
   - Mixing `caseID` and `caseID`
   - Not using `DB_TABLES` and `DB_COLUMNS` constants

6. **Best Practices**
   - Always use `DB_TABLES` and `DB_COLUMNS` constants
   - Keep casing consistent across all files
   - Use TypeScript to catch casing errors
   - Add ESLint rules to enforce casing
   - Document any exceptions to the casing rules

### Validation Checklist

- [ ] All IDs are integers in database operations
- [ ] Models are stringified before storage
- [ ] Foreign keys use correct column names
- [ ] ID type conversions are handled properly
- [ ] Error handling includes type validation
- [ ] Database operations use correct data types

### IMPORTANT: Whenever you change the schema in `src/app/lib/db.ts` (such as adding, removing, or altering tables/columns/indexes), you must reset the database by POSTing to `/api/reset-db` to ensure the schema is up to date. This will drop and recreate all tables.

## ID Usage and References

### Key Rules for ID Usage

1. **Always Use Database IDs**

   - Never use names or other properties as identifiers
   - Always use the numeric ID from the database for references
   - Convert string IDs to integers when working with the database
   - Example:

     ```typescript
     // ❌ Incorrect - Using name as ID
     const stage = stages.find((s) => s.name === stageId);

     // ✅ Correct - Using numeric ID
     const stage = stages.find((s) => s.id === stageId);
     ```

2. **ID Types**

   - Database IDs are always integers
   - Convert string IDs to integers before database operations
   - Use TypeScript to enforce ID types:
     ```typescript
     interface Stage {
       id: number; // Database ID
       name: string; // Display name
     }
     ```

3. **ID References**

   - Use IDs for all relationships between entities
   - Never use names for relationships
   - Example:

     ```typescript
     // ❌ Incorrect - Using names for relationships
     {
       stageName: "stage1",
       processName: "process1",
       stepName: "step1"
     }

     // ✅ Correct - Using IDs for relationships
     {
       stageId: 1,
       processId: 2,
       stepId: 3
     }
     ```

4. **ID Generation**

   - Let the database generate IDs
   - Never generate IDs in the frontend
   - Use auto-incrementing IDs from the database
   - Example:

     ```typescript
     // ❌ Incorrect - Generating ID in frontend
     const newId = uuidv4();

     // ✅ Correct - Let database generate ID
     const response = await fetch("/api/database?table=fields", {
       method: "POST",
       body: JSON.stringify({
         table: "fields",
         data: {
           name: "fieldName",
           type: "Text",
           caseID: caseID,
         },
       }),
     });
     const { data } = await response.json();
     const newId = data.id; // Use database-generated ID
     ```

5. **ID Validation**

   - Always validate IDs before use
   - Check that IDs are numbers
   - Verify IDs exist in the database
   - Example:

     ```typescript
     function isValidId(id: unknown): id is number {
       return typeof id === "number" && Number.isInteger(id) && id > 0;
     }

     if (!isValidId(stageId)) {
       throw new Error("Invalid stage ID");
     }
     ```

6. **ID Storage**

   - Store IDs as numbers in memory
   - Convert IDs to strings only for display
   - Use TypeScript to enforce ID types
   - Example:

     ```typescript
     interface Stage {
       id: number; // Store as number
       name: string;
     }

     // Convert to string only for display
     const displayId = `Stage ${stage.id}`;
     ```

7. **Common Pitfalls**

   - Using names instead of IDs for relationships
   - Not converting string IDs to numbers
   - Generating IDs in the frontend
   - Using inconsistent ID types
   - Not validating IDs before use

8. **Best Practices**
   - Always use database-generated IDs
   - Convert string IDs to numbers before database operations
   - Use TypeScript to enforce ID types
   - Validate IDs before use
   - Use consistent ID types throughout the application
   - Document ID requirements and constraints

## RESTful API Patterns

### Request/Response Structure

1. **Case Updates**

   - Use `PATCH` for partial updates (adding/editing stages, processes, steps)
   - Use `DELETE` for removing items (stages, processes, steps)
   - Request body should only include the `model` field:
     ```typescript
     const requestBody = {
       model: JSON.stringify(updatedModel),
     };
     ```

2. **HTTP Methods**

   - `PATCH`: For adding and editing operations
     ```typescript
     const response = await fetch(requestUrl, {
       method: "PATCH",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(requestBody),
     });
     ```
   - `DELETE`: For removing operations
     ```typescript
     const response = await fetch(requestUrl, {
       method: "DELETE",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(requestBody),
     });
     ```

3. **Error Handling**

   - Always include detailed error logging:
     ```typescript
     if (!response.ok) {
       const errorText = await response.text();
       console.error("=== Database Update Failed ===");
       console.error("Status:", response.status);
       console.error("Status Text:", response.statusText);
       console.error("Error Response:", errorText);
       console.error("Request Details:", {
         url: requestUrl,
         method: "PATCH/DELETE",
         body: requestBody,
       });
       throw new Error(
         `Failed to ${operation}: ${response.status} ${errorText}`,
       );
     }
     ```

4. **Request Logging**

   - Log request details before making the call:
     ```typescript
     console.log("=== Making Database Update Request ===");
     console.log("Request URL:", requestUrl);
     console.log("Request Method: PATCH/DELETE");
     console.log("Request Body:", {
       ...requestBody,
       model: "Stringified model data (truncated for logging)",
     });
     ```

5. **Response Handling**

   - Always parse and validate the response:
     ```typescript
     const { data: updatedCase } = await response.json();
     setSelectedCase(updatedCase);
     ```

6. **Common Pitfalls**

   - Don't include unnecessary fields in the request body
   - Don't use `PUT` for partial updates
   - Don't use `POST` for updates
   - Don't omit error handling
   - Don't skip request logging

7. **Best Practices**

   - Use consistent HTTP methods across all operations
   - Include detailed error logging
   - Log request details before making the call
   - Validate responses before using them
   - Use TypeScript for type safety
   - Keep request bodies minimal
   - Follow RESTful conventions

## System Prompt Management

### Single Source of Truth

1. **System Prompt Location**

   - The system prompt is defined in `src/app/lib/databasePrompt.ts`
   - This is the ONLY place where the system prompt should be defined
   - All other files should import and use `databaseSystemPrompt` from this file

2. **Importing the System Prompt**

   ```typescript
   // ✅ Correct - Import from databasePrompt.ts
   import { databaseSystemPrompt } from "../lib/databasePrompt";

   // ❌ Incorrect - Don't define system prompt in other files
   private static readonly SYSTEM_MESSAGE = `...`;
   ```

3. **Using the System Prompt**

   ```typescript
   // ✅ Correct - Use imported databaseSystemPrompt
   const systemContext = currentModel
     ? `${databaseSystemPrompt}\n\nCurrent workflow model:\n${JSON.stringify(
         model,
       )}`
     : databaseSystemPrompt;

   // ❌ Incorrect - Don't use hardcoded system prompt
   const systemContext = `${this.SYSTEM_MESSAGE}\n\n...`;
   ```

4. **Common Pitfalls to Avoid**

   - ❌ Don't duplicate the system prompt in multiple files
   - ❌ Don't define system prompt as a constant in service classes
   - ❌ Don't hardcode system prompt in API routes
   - ✅ Always import from `databasePrompt.ts`
   - ✅ Use the imported `databaseSystemPrompt` variable
   - ✅ Keep all system prompt modifications in `databasePrompt.ts`

5. **Implementation Checklist**

   - [ ] System prompt is defined only in `databasePrompt.ts`
   - [ ] All files import `databaseSystemPrompt` from `databasePrompt.ts`
   - [ ] No duplicate system prompt definitions exist
   - [ ] System prompt is used consistently across the application
   - [ ] Changes to system prompt are made only in `databasePrompt.ts`

6. **Error Handling**

   - If you encounter a "No createCase tool call found in response" error:
     1. Check that the system prompt is being imported correctly
     2. Verify that no duplicate system prompts exist
     3. Ensure the system prompt includes all required tool call formats
     4. Validate that the system prompt is being passed correctly to the API

7. **Testing Requirements**

   - Test that system prompt is loaded correctly
   - Verify that tool calls are properly formatted
   - Ensure system prompt changes are reflected everywhere
   - Test with different model providers (Gemini, OpenAI)

8. **Debugging Tips**
   - Log the system prompt length to verify it's loaded
   - Check that tool call formats match the system prompt
   - Verify system prompt is included in API requests
   - Monitor for any duplicate system prompt definitions

## JSON Formatting and Model Structure

### Model Structure Requirements

1. **Valid JSON Format**

   - All JSON must use double quotes for property names and string values
   - No trailing commas in arrays or objects
   - No unescaped newlines in strings
   - Example:

     ```typescript
     // ✅ Correct
     {
       "name": "Home Construction",
       "description": "Workflow to build a new home",
       "model": {
         "stages": [
           {
             "id": "stage1",
             "name": "Planning",
             "order": 1,
             "processes": []
           }
         ]
       }
     }

     // ❌ Incorrect
     {
       name: "Home Construction",  // Missing quotes
       'description': 'Workflow',  // Single quotes
       "model": {
         "stages": [
           {
             "id": "stage1",
             "name": "Planning",
             "order": 1,
             "processes": [],  // Trailing comma
           }
         ]
       }
     }
     ```

2. **Model Structure Validation**

   - Each stage must have:
     - `id`: string
     - `name`: string
     - `order`: number
     - `processes`: array
   - Each process must have:
     - `id`: string
     - `name`: string
     - `order`: number
     - `steps`: array
   - Each step must have:
     - `id`: string
     - `type`: string (valid step type)
     - `name`: string
     - `order`: number
     - `viewId`: string (for "Collect information" steps)

3. **Common JSON Errors**

   - ❌ Missing quotes around property names
   - ❌ Using single quotes instead of double quotes
   - ❌ Trailing commas in arrays or objects
   - ❌ Unescaped newlines in strings
   - ❌ Missing commas between properties
   - ❌ Extra commas after last property
   - ❌ Mismatched brackets or braces

4. **JSON Cleaning Process**

   ```typescript
   // Clean JSON string before parsing
   const cleanJsonString = jsonString
     .replace(/\n/g, "") // Remove newlines
     .replace(/\s+/g, " ") // Normalize whitespace
     .replace(/([{,]\s*)(\w+):/g, '$1"$2":') // Add quotes to property names
     .replace(/'/g, '"') // Replace single quotes with double quotes
     .replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas
   ```

5. **Implementation Checklist**

   - [ ] All property names are double-quoted
   - [ ] All string values are double-quoted
   - [ ] No trailing commas in arrays or objects
   - [ ] No unescaped newlines in strings
   - [ ] Model structure follows the required format
   - [ ] Step types are valid
   - [ ] Required properties are present
   - [ ] JSON is properly cleaned before parsing

6. **Error Handling**

   - If you encounter a "Failed to parse createCase params" error:
     1. Check the JSON structure for syntax errors
     2. Verify all property names are double-quoted
     3. Ensure no trailing commas exist
     4. Validate the model structure
     5. Clean the JSON string before parsing
     6. Log the cleaned JSON for debugging

7. **Testing Requirements**

   - Test with various model structures
   - Verify JSON cleaning process
   - Test with different step types
   - Validate model structure
   - Test error handling
   - Verify JSON parsing

8. **Debugging Tips**
   - Log the raw JSON string
   - Log the cleaned JSON string
   - Use a JSON validator
   - Check for common syntax errors
   - Verify model structure
   - Test with minimal valid model

## LLM Provider Configuration

The application supports multiple LLM providers (Azure OpenAI and Google Gemini). Each provider requires specific environment variables and configuration:

1. **Azure OpenAI Configuration**
   Required environment variables:

   ```
   AZURE_OPENAI_ENDPOINT=https://your-resource-name.openai.azure.com
   AZURE_OPENAI_DEPLOYMENT=your-deployment-name
   AZURE_TENANT_ID=your-tenant-id
   AZURE_CLIENT_ID=your-client-id
   AZURE_CLIENT_SECRET=your-client-secret
   ```

2. **Google Gemini Configuration**
   Required environment variable:

   ```
   GEMINI_API_KEY=your-gemini-api-key
   ```

3. **Provider Selection**

   - The application uses a provider selection mechanism in `src/app/services/service.ts`
   - Default provider is set to "openai"
   - Can be switched between "openai" and "gemini" using `Service.setProvider()`
   - Both providers must be properly configured even if only one is actively used

4. **API Routes**

   - `/api/openai` - Handles Azure OpenAI requests
   - `/api/gemini` - Handles Google Gemini requests
   - Both routes must be maintained and kept functional

5. **Common Pitfalls**
   - Do not remove either provider's implementation
   - Keep both API routes functional
   - Maintain environment variables for both providers
   - Test both providers when making changes to shared code
