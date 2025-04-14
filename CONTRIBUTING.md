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
  - [Key Rules for Model Changes](#key-rules-for-model-changes)
  - [Validation Checklist](#validation-checklist)
  - [Common Pitfalls](#common-pitfalls)

## Field Management

### Field References vs Field Definitions

The application maintains a clear separation between field definitions and field references:

- **Field Definitions** (`Field[]`) are stored in the main fields array and contain the complete field information:

  ```typescript
  interface Field {
    name: string; // Unique identifier
    label: string; // Display label
    type: fieldType; // Field type
    primary?: boolean; // Whether it's a primary field
    // ... other field properties
  }
  ```

- **Field References** (`FieldReference[]`) are used in steps/views and only contain reference information:
  ```typescript
  interface FieldReference {
    name: string; // References the field definition's name
    required?: boolean; // Step-specific requirement
  }
  ```

### Field Operations

1. **Field Reordering vs Adding Fields**

   - When handling drag and drop operations, first determine if it's a reorder or add operation:

   ```typescript
   const isReorder =
     fieldIds.every((fieldId) =>
       existingFields.some((existingField) => existingField.name === fieldId),
     ) && fieldIds.length === existingFields.length;
   ```

   - For reordering (when all fields exist and lengths match):

   ```typescript
   // Preserve existing field properties while updating order
   const reorderedFields = fieldIds.map((fieldId) => ({
     name: fieldId,
     required:
       existingFields.find((f) => f.name === fieldId)?.required ?? false,
   }));
   ```

   - For adding new fields:

   ```typescript
   // Add new fields while preserving existing ones
   const newFields = fieldIds.map((fieldId) => ({
     name: fieldId,
     required: false,
   }));
   const combinedFields = [
     ...existingFields,
     ...newFields.filter(
       (newField) =>
         !existingFields.some(
           (existingField) => existingField.name === newField.name,
         ),
     ),
   ];
   ```

2. **Drag and Drop Implementation**

   - Always use unique identifiers for draggable items:

   ```typescript
   <Draggable
     key={`${field.name}-${index}`}
     draggableId={`${field.name}-${index}`}
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
       name: fieldId,
       required:
         existingFields.find((f) => f.name === fieldId)?.required ?? false,
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
   const handleRemoveField = (fieldId: string) => {
     const updatedFields = stepFields.filter((field) => field.name !== fieldId);
     onAddExistingField(
       step.id,
       updatedFields.map((field) => field.name),
     );
   };
   ```

2. **Adding Fields**

   - When adding new fields, first create the field definition
   - Then add a reference to the step/view

   ```typescript
   const newFieldName = onAddField({
     /* field definition */
   });
   onAddExistingField(stepId, [newFieldName]);
   ```

3. **Field Names**

   - Field names must be unique across the entire application
   - Never create multiple fields with the same name
   - Use descriptive and specific names to avoid conflicts
   - When using fields in drag-and-drop contexts, ensure unique keys by combining multiple identifiers:

   ```typescript
   // For fields
   <Draggable
     key={`${field.name}-${index}`}
     draggableId={`${field.name}-${index}`}  // draggableId should match key
     index={index}
   >

   // For nested structures (e.g., stages/processes/steps)
   <Draggable
     key={`${type}-${parentId}-${item.name}-${index}`}
     draggableId={`${type}-${parentId}-${item.name}-${index}`}
     index={index}
   >
   ```

4. **Displaying Fields**
   - Always map field references to their full definitions before display
   - Merge reference properties with the field definition
   ```typescript
   const displayFields = fieldRefs
     .map((ref) => {
       const field = fields.find((f) => f.name === ref.name);
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

## Model Validation and Data Consistency

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

### Key Rules for Model Changes

1. **Adding New Model Properties**

   - When adding a new property to the model, update ALL of the following:
     - TypeScript interfaces in `src/app/types.ts`
     - API route validation in both `src/app/api/gemini/route.ts` and `src/app/api/openai/route.ts`
     - Session storage handling in `src/app/page.tsx`
     - AI system prompt in `src/app/services/service.ts`
     - Initial state loading and state management
     - Default model in `model.json`

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

3. **Session Storage**

   - All model properties must be properly persisted in session storage:

   ```typescript
   // When saving to session storage
   sessionStorage.setItem("workflow_name", workflowName);
   sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stages));
   sessionStorage.setItem("workflow_fields", JSON.stringify(fields));
   // Add new properties to session storage here

   // When loading from session storage
   const savedName = sessionStorage.getItem("workflow_name");
   const savedStages = sessionStorage.getItem(SESSION_STORAGE_KEY);
   const savedFields = sessionStorage.getItem("workflow_fields");
   // Load new properties from session storage here
   ```

4. **State Management**

   - Each model property should have corresponding state management:

   ```typescript
   const [workflowName, setWorkflowName] = useState<string>("");
   const [stages, setStages] = useState<Stage[]>([]);
   const [fields, setFields] = useState<Field[]>([]);
   // Add state for new properties here
   ```

5. **AI System Prompt**
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
