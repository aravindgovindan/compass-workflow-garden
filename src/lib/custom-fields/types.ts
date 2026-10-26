export const CUSTOM_FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "date",
  "dropdown",
  "multi_select",
  "user",
  "checkbox",
  "url",
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_ENTITIES = ["task", "risk", "issue"] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Short text",
  long_text: "Long text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
  multi_select: "Multi-select",
  user: "Person",
  checkbox: "Checkbox",
  url: "Link (URL)",
};

export const TYPES_WITH_OPTIONS: readonly CustomFieldType[] = ["dropdown", "multi_select"];

export type CustomFieldDef = {
  id: string;
  key: string;
  name: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  default_value?: unknown;
  archived?: boolean;
};

export type CustomValues = Record<string, unknown>;
