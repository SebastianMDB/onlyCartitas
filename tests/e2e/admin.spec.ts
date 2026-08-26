import { expect, test } from "@playwright/test";

const apiUrl = "http://localhost:3000";

test("admin can review purchase history and manage discount codes", async ({ page }) => {
  const statusUpdates: unknown[] = [];
  const createdDiscounts: unknown[] = [];
  const createdShippingSectors: unknown[] = [];
  const updatedShippingSectors: unknown[] = [];
  let shippingSectors = [
    {
      id: "sector-norte",
      name: "Sector norte",
      price: 3500,
      active: true
    }
  ];

  await page.route(`${apiUrl}/api/auth/login`, async (route) => {
    await route.fulfill({
      json: {
        user: { id: "admin-1", username: "admin", role: "admin" },
        token: "admin-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString()
      }
    });
  });

  await page.route(`${apiUrl}/api/orders`, async (route) => {
    await route.fulfill({
      json: {
        data: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            customer_name: "Cliente Test",
            customer_email: "cliente@example.com",
            delivery_mode: "envio",
            address: "Av Test 123, Antofagasta, Antofagasta",
            items: [
              {
                id: "item-1",
                product_id: "etb-journey",
                name: "Journey Together Elite Trainer Box",
                quantity: 2,
                unit_price: 50000,
                subtotal: 100000
              }
            ],
            subtotal: 20,
            shipping: 4.99,
            discount: 2,
            total: 22.99,
            status: "pending",
            metadata: {
              delivery_address: {
                comuna: "Antofagasta",
                region: "Antofagasta",
                shipping_payment: "included"
              },
              shipping_sector: {
                id: "sector-norte",
                name: "Sector norte",
                price: 3500
              }
            },
            created_at: "2026-05-10T12:00:00.000Z"
          }
        ]
      }
    });
  });

  await page.route(`${apiUrl}/api/orders/*/status`, async (route) => {
    statusUpdates.push(route.request().postDataJSON());
    await route.fulfill({ json: { data: { ok: true } } });
  });

  await page.route(`${apiUrl}/api/admin/discount-codes`, async (route) => {
    if (route.request().method() === "POST") {
      createdDiscounts.push(route.request().postDataJSON());
      await route.fulfill({ json: { data: { id: "new-code" } } });
      return;
    }

    await route.fulfill({
      json: {
        data: [
          {
            id: "discount-1",
            code: "ONLY10",
            type: "percent",
            value: 10,
            active: true,
            used_count: 1,
            max_uses: 20
          }
        ]
      }
    });
  });

  await page.route(`${apiUrl}/api/admin/shipping-sectors`, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      createdShippingSectors.push(body);
      const sector = { id: "sector-sur", ...body };
      shippingSectors = [...shippingSectors, sector];
      await route.fulfill({ json: { data: sector } });
      return;
    }

    await route.fulfill({ json: { data: shippingSectors } });
  });

  await page.route(`${apiUrl}/api/admin/shipping-sectors/*`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      updatedShippingSectors.push(body);
      shippingSectors = shippingSectors.map((sector) =>
        route.request().url().endsWith(sector.id) ? { ...sector, ...body } : sector
      );
      await route.fulfill({ json: { data: shippingSectors.find((sector) => route.request().url().endsWith(sector.id)) } });
      return;
    }

    await route.fulfill({ json: { data: null } });
  });

  await page.goto("/admin-inventario");
  await page.locator("[data-admin-user]").fill("admin");
  await page.locator("[data-admin-password]").fill("admin1234");
  await page.getByRole("button", { name: "Entrar" }).click();

  await page.getByRole("button", { name: "Compras" }).click();
  await expect(page.getByText("Cliente Test")).toBeVisible();
  await expect(page.getByText("Journey Together Elite Trainer Box")).toBeVisible();
  await expect(page.getByText("Av Test 123, Antofagasta, Antofagasta - Sector: Sector norte - Envio incluido")).toBeVisible();
  await expect(page.getByText("etb-journey")).toBeVisible();
  await page.locator("[data-order-user-filter]").fill("cliente@example.com");
  await expect(page.getByText("1 de 1 compra(s)")).toBeVisible();

  await page.locator("[data-order-status]").selectOption("paid");
  await expect.poll(() => statusUpdates).toEqual([{ status: "paid" }]);

  await page.getByRole("button", { name: "Descuentos" }).click();
  await expect(page.getByText("ONLY10")).toBeVisible();
  await page.locator("[data-discount-code-input]").fill("MAYO15");
  await page.locator("[data-discount-value-input]").fill("15");
  await page.locator("[data-discount-max-input]").fill("5");
  await page.getByRole("button", { name: "Crear" }).click();
  await expect.poll(() => createdDiscounts).toEqual([
    { code: "MAYO15", type: "percent", value: 15, active: true, maxUses: 5 }
  ]);

  await page.locator('[data-admin-tab="shipping"]').click();
  await expect(page.locator('[data-shipping-sector-name="sector-norte"]')).toHaveValue("Sector norte");
  await page.locator("[data-shipping-sector-name-input]").fill("Sector sur");
  await page.locator("[data-shipping-sector-price-input]").fill("4500");
  await page.getByRole("button", { name: "Crear" }).click();
  await expect.poll(() => createdShippingSectors).toEqual([{ name: "Sector sur", price: 4500, active: true }]);
  await expect(page.locator('[data-shipping-sector-name="sector-sur"]')).toHaveValue("Sector sur");

  await page.locator('[data-shipping-sector-price="sector-norte"]').fill("3000");
  await page.locator('[data-shipping-sector-save="sector-norte"]').click();
  await expect.poll(() => updatedShippingSectors).toEqual([{ name: "Sector norte", price: 3000, active: true }]);
});
