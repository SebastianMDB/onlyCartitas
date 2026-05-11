import { expect, test } from "@playwright/test";

const apiUrl = "http://localhost:3000";

test("checkout validates discount code through API and sends it with the order", async ({ page }) => {
  const orders: unknown[] = [];

  await page.addInitScript(() => {
    window.localStorage.setItem(
      "carta-noble-cart",
      JSON.stringify([
        {
          id: "etb-journey",
          name: "Journey Together Elite Trainer Box",
          category: "Elite Trainer Box",
          set: "Journey Together",
          language: "Ingles",
          stock: 4,
          price: 50000,
          image: "/favicon.svg",
          quantity: 1
        }
      ])
    );
  });

  await page.route(`${apiUrl}/api/discount-codes/validate`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ code: "ONLY10", subtotal: 50000 });
    await route.fulfill({
      json: {
        data: {
          code: "ONLY10",
          type: "percent",
          value: 10,
          discount: 5000
        }
      }
    });
  });

  await page.route(`${apiUrl}/api/orders`, async (route) => {
    orders.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        data: {
          id: "22222222-2222-4222-8222-222222222222"
        }
      }
    });
  });

  await page.route(`${apiUrl}/api/payments/mercadopago/preferences`, async (route) => {
    await route.fulfill({
      status: 503,
      json: { error: "Mercado Pago no esta configurado" }
    });
  });

  await page.goto("/checkout");
  await page.locator("[data-discount-code]").fill("ONLY10");
  await page.locator("[data-apply-discount]").click();
  await expect(page.getByText("Descuento aplicado.")).toBeVisible();

  await page.locator("[data-checkout-email]").fill("cliente@example.com");
  await page.locator("[data-checkout-first-name]").fill("Cliente");
  await page.locator("[data-checkout-last-name]").fill("Test");
  await page.locator("input[placeholder='RUT']").fill("11111111-1");
  await page.locator("[data-checkout-address]").fill("Av Test 123");
  await page.locator("input[placeholder='Comuna']").fill("Santiago");
  await page.locator("[data-checkout-phone]").fill("+56911111111");
  await page.locator("[data-terms-check]").check();
  await page.locator("[data-pay-button]").click();

  await expect(page.getByText("Compra registrada")).toBeVisible();
  await expect.poll(() => orders).toHaveLength(1);
  expect(orders[0]).toMatchObject({
    customerName: "Cliente Test",
    customerEmail: "cliente@example.com",
    deliveryMode: "envio",
    discountCode: "ONLY10",
    items: [{ id: "etb-journey", quantity: 1 }]
  });
});
