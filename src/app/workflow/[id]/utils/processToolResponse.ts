import { FieldWithType } from "../page";

export default function processToolResponse(text: string): string {
  // First, detect and prettify tool call blocks for display:
  // Convert occurrences of
  //   TOOL: <name> PARAMS: { ... }
  // (including when wrapped in ```tool_code fences) into:
  //   Tool: <name>\n```json\n<pretty json>\n```
  try {
    // Handle fenced code variant first
    const fencedPattern =
      /```(?:tool_code)?\s*\n(TOOL:\s*\w+\s+PARAMS:\s*{[\s\S]*?})\s*\n```/g;
    if (fencedPattern.test(text)) {
      text = text.replace(fencedPattern, (_m, inner: string) => {
        const m = inner.match(/TOOL:\s*(\w+)\s+PARAMS:\s*({[\s\S]*?})/);
        if (!m) return inner;
        const toolName = m[1];
        const paramsStr = m[2];
        try {
          const parsed = JSON.parse(paramsStr);
          const pretty = JSON.stringify(parsed, null, 2);
          return `Tool: ${toolName}\n\nParams:\n\n\
\`\`\`json\n${pretty}\n\`\`\``;
        } catch {
          // If JSON is incomplete or invalid, just convert label casing
          return inner
            .replace(/^TOOL:/, "Tool:")
            .replace(/\sPARAMS:/, " Params:");
        }
      });
    }

    // Handle inline/plain occurrences, potentially multiple in one string
    // We replace iteratively to avoid overly-greedy matching across blocks
    const plainPattern = /TOOL:\s*(\w+)\s+PARAMS:\s*({[\s\S]*?})/m;
    let safetyCounter = 0;
    while (plainPattern.test(text) && safetyCounter < 10) {
      safetyCounter++;
      text = text.replace(
        plainPattern,
        (match, toolName: string, paramsStr: string) => {
          try {
            const parsed = JSON.parse(paramsStr);
            const pretty = JSON.stringify(parsed, null, 2);
            return `Tool: ${toolName}\n\nParams:\n\n\
\`\`\`json\n${pretty}\n\`\`\``;
          } catch {
            // If JSON not parseable, keep original but adjust label casing
            return match
              .replace(/^TOOL:/, "Tool:")
              .replace(/\sPARAMS:/, " Params:");
          }
        },
      );
    }
  } catch {
    // Non-fatal; fall through to existing behavior below
  }

  try {
    const jsonData = JSON.parse(text);
    if (typeof jsonData === "object" && jsonData !== null) {
      if (
        jsonData.ids &&
        Array.isArray(jsonData.ids) &&
        jsonData.fields &&
        Array.isArray(jsonData.fields)
      ) {
        const fieldCount = jsonData.fields.length;
        const fieldNames = (jsonData.fields as FieldWithType[]).map(
          (f) => f.name,
        );
        return `Saved ${fieldCount} field${
          fieldCount === 1 ? "" : "s"
        }: ${fieldNames.join(", ")}`;
      }
      if (jsonData.name && jsonData.type && jsonData.id) {
        return `Field '${jsonData.name}' of type ${jsonData.type} saved successfully`;
      } else if (jsonData.name && jsonData.caseid && jsonData.model) {
        return `View '${jsonData.name}' saved successfully`;
      } else if (jsonData.name && jsonData.description && jsonData.model) {
        return `Workflow '${jsonData.name}' saved successfully`;
      } else if (jsonData.message) {
        return jsonData.message;
      } else if (jsonData.id && jsonData.name) {
        return `Saved '${jsonData.name}'`;
      } else if (Array.isArray(jsonData)) {
        if (jsonData.length === 0) return "No items found";
        return `Found ${jsonData.length} item${
          jsonData.length === 1 ? "" : "s"
        }`;
      } else if (
        jsonData.success &&
        jsonData.deletedId &&
        jsonData.deletedName &&
        jsonData.type
      ) {
        const itemType =
          jsonData.type === "field"
            ? "field"
            : jsonData.type === "view"
            ? "view"
            : "item";
        if (jsonData.type === "field" && jsonData.updatedViewsCount) {
          return `Deleted ${itemType} '${jsonData.deletedName}' (removed from ${
            jsonData.updatedViewsCount
          } view${jsonData.updatedViewsCount === 1 ? "" : "s"})`;
        }
        return `Deleted ${itemType} '${jsonData.deletedName}'`;
      } else if (jsonData.success && jsonData.deletedId) {
        return `Item with ID ${jsonData.deletedId} deleted successfully`;
      } else if (jsonData.error) {
        return `Error: ${jsonData.error}`;
      }
    }
  } catch (_e) {
    // Not JSON, use as is
  }
  return text;
}
