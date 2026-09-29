import { expect, test } from "@playwright/test";

test("cria um modelo de e-mail e uma automação", async ({ page }) => {
  const templates: Array<Record<string, unknown>> = [];
  const automations: Array<Record<string, unknown>> = [];

  await page.route("**/api/dashboard", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          automations,
          runs: [],
          emails: [],
          metrics: { executions: 0, successRate: 0, timeSavedMinutes: 0 },
        },
      });
      return;
    }

    const body = route.request().postDataJSON();
    const automation = {
      id: 101,
      name: body.name,
      description: body.description,
      triggerType: body.triggerType,
      actionType: body.actionType,
      templateId: body.templateId,
      status: "active",
      runs: 0,
      successRate: 0,
    };
    automations.unshift(automation);
    await route.fulfill({ json: { automation } });
  });

  await page.route("**/api/email-templates", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { templates } });
      return;
    }

    const body = route.request().postDataJSON();
    const template = { ...body, id: 55 };
    templates.unshift(template);
    await route.fulfill({ json: { template } });
  });

  await page.route("**/api/integrations/gmail/status", (route) =>
    route.fulfill({ json: { connected: false } }),
  );
  await page.route("**/api/webhooks/config", (route) =>
    route.fulfill({ json: { configured: false } }),
  );

  await page.goto("/");
  await page.getByRole("button", { name: /E-mails/ }).click();
  await page.getByRole("button", { name: "Novo modelo" }).click();
  await page.getByLabel("Nome do modelo").fill("Boas-vindas E2E");
  await page
    .getByLabel("Assunto ou tema para a IA")
    .fill("Bem-vinda, {{nome}}");
  await page
    .getByLabel("Mensagem ou orientações")
    .fill("Olá {{nome}}, sua conta foi criada com sucesso.");
  await page.getByRole("button", { name: "Salvar modelo" }).click();

  await expect(
    page.getByRole("heading", { name: "Boas-vindas E2E" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Automações/ }).click();
  await page.getByRole("button", { name: "Nova automação" }).click();
  await page.getByLabel("Nome da automação").fill("Receber novo usuário");
  await page
    .getByLabel("Descrição")
    .fill("Envia as boas-vindas após o cadastro.");
  await page.getByLabel("Modelo de e-mail").selectOption("55");
  await page.getByRole("button", { name: "Criar automação" }).click();

  await expect(
    page.getByRole("heading", { name: "Receber novo usuário" }),
  ).toBeVisible();
  await expect(page.getByText("Automação criada com sucesso")).toBeVisible();
});
