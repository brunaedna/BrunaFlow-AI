export const TEMPLATE_VARIABLES = [
  "nome",
  "email",
  "mensagem",
  "classificacao",
  "prioridade",
  "nome_automacao",
] as const;

export type TemplateVariables = Record<
  (typeof TEMPLATE_VARIABLES)[number],
  string
>;

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .slice(0, maxLength);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function renderTemplate(value: string, variables: TemplateVariables) {
  return value.replace(
    /\{\{\s*(nome|email|mensagem|classificacao|prioridade|nome_automacao)\s*\}\}/gi,
    (_, key: string) =>
      variables[key.toLowerCase() as keyof TemplateVariables] || "",
  );
}

export async function sha256Hex(value: string) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function normalizeWebhookPayload(value: unknown) {
  const payload =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    automationId: Number(payload.automationId || 0) || undefined,
    automationName: cleanText(payload.automationName, 120),
    eventType: cleanText(payload.event, 120),
    contactName: cleanText(payload.name, 100) || "Contato",
    contactEmail: cleanText(payload.email, 320).toLowerCase(),
    message: cleanText(payload.message, 3000),
  };
}
