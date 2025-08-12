import { FieldWithType } from "../page";

export default function processToolResponse(text: string): string {
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
