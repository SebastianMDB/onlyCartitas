type ProductLanguage = "japanese" | "spanish" | "english";
type Product = {
  id: string;
  kind: "sealed" | "single";
  name: string;
  category: string;
  set: string;
  language: ProductLanguage;
  stock: number;
  variants?: Array<{ id: string; name: string; stock: number; active: boolean }> | null;
  price: number;
  previousPrice?: number | null;
  image: string;
  offer?: string | null;
  illustrator?: string | null;
};

const languageLabels: Record<ProductLanguage, string> = {
  japanese: "Japones",
  spanish: "Espanol",
  english: "Ingles"
};

const currencyFormatter = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0
});

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const readConfig = () => {
  const configElement = document.querySelector("[data-product-detail-config]");
  try {
    return configElement?.textContent ? JSON.parse(configElement.textContent) : {};
  } catch {
    return {};
  }
};

let productDetailAbortController: AbortController | null = null;

const renderProduct = (product: Product) => {
  const languageLabel = languageLabels[product.language] ?? product.language;
  const variants = Array.isArray(product.variants) ? product.variants.filter((variant) => variant.active !== false) : [];
  const selectedVariant = variants.find((variant) => variant.stock > 0) ?? variants[0] ?? null;
  const selectedStock = selectedVariant ? selectedVariant.stock : product.stock;
  const discountPercent =
    product.previousPrice && product.previousPrice > product.price
      ? Math.round(((product.previousPrice - product.price) / product.previousPrice) * 100)
      : null;

  return `
    <section class="mx-auto grid w-full max-w-7xl gap-8 px-4 pt-8 sm:px-6 lg:grid-cols-[minmax(0,520px)_1fr] lg:px-8" data-product-id="${escapeHtml(product.id)}">
      <div class="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(17,48,71,0.08)]">
        <div class="relative flex aspect-[4/5] items-center justify-center rounded-[1.6rem] bg-[color:var(--color-surface)] p-5">
          ${discountPercent ? `<span class="absolute left-5 top-5 rounded-full bg-amber-300 px-3 py-1 text-sm font-semibold text-slate-950">-${discountPercent}%</span>` : ""}
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" class="h-full w-full object-contain" width="900" height="1100" decoding="async" />
        </div>
      </div>

      <div class="flex flex-col gap-6">
        <div class="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(17,48,71,0.08)] sm:p-7">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-secondary)]">${escapeHtml(product.category)}</p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--color-primary)] sm:text-5xl">${escapeHtml(product.name)}</h1>
          <p class="mt-4 text-base leading-7 text-slate-600">
            Producto del set ${escapeHtml(product.set)}, disponible en idioma ${escapeHtml(languageLabel)}. Ideal para coleccion, juego o reposicion de inventario.
          </p>

          <div class="mt-6 grid gap-3 sm:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Stock</p>
              <p class="mt-2 text-2xl font-semibold text-[color:var(--color-primary)]" data-product-stock-label>Stock ${escapeHtml(product.stock)}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Idioma</p>
              <p class="mt-2 text-lg font-semibold text-slate-950">${escapeHtml(languageLabel)}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Set</p>
              <p class="mt-2 text-lg font-semibold text-slate-950">${escapeHtml(product.set)}</p>
            </div>
          </div>

          <div class="mt-7 flex flex-wrap items-end gap-3">
            <p class="text-4xl font-semibold text-[color:var(--color-primary)]">${currencyFormatter.format(product.price)}</p>
            ${product.previousPrice ? `<p class="pb-1 text-lg text-slate-400 line-through">${currencyFormatter.format(product.previousPrice)}</p>` : ""}
          </div>

          ${
            variants.length
              ? `<div class="mt-6" data-variant-picker>
                  <p class="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Diseno</p>
                  <div class="flex flex-wrap gap-2">
                    ${variants
                      .map(
                        (variant) =>
                          `<button type="button" class="rounded-full border px-4 py-2 text-sm font-semibold transition ${variant.id === selectedVariant?.id ? "border-slate-950 bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"} disabled:cursor-not-allowed disabled:opacity-45" data-product-variant="${escapeHtml(variant.id)}" data-variant-name="${escapeHtml(variant.name)}" data-variant-stock="${escapeHtml(variant.stock)}" ${variant.stock <= 0 ? "disabled" : ""}>${escapeHtml(variant.name)}</button>`
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }

          <button
            type="button"
            class="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#071c2b] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(17,48,71,0.18)] transition hover:bg-[#0d2a3f] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none sm:w-auto"
            data-cart-add
            data-cart-id="${escapeHtml(product.id)}"
            data-cart-name="${escapeHtml(product.name)}"
            data-cart-category="${escapeHtml(product.category)}"
            data-cart-set="${escapeHtml(product.set)}"
            data-cart-language="${escapeHtml(languageLabel)}"
            data-cart-price="${escapeHtml(product.price)}"
            data-cart-stock="${escapeHtml(selectedStock)}"
            data-cart-variant-id="${escapeHtml(selectedVariant?.id ?? "")}"
            data-cart-variant-name="${escapeHtml(selectedVariant?.name ?? "")}"
            data-cart-image="${escapeHtml(product.image)}"
            ${selectedStock <= 0 ? "disabled" : ""}
          >
            ${selectedStock > 0 ? "Agregar al carrito" : "Sin stock"}
          </button>
        </div>

        <div class="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(17,48,71,0.08)] sm:p-7">
          <h2 class="text-xl font-semibold text-[color:var(--color-primary)]">Detalles</h2>
          <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="font-semibold text-slate-500">Categoria</dt>
              <dd class="mt-1 text-slate-950">${escapeHtml(product.category)}</dd>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="font-semibold text-slate-500">Disponibilidad</dt>
              <dd class="mt-1 text-slate-950">${product.stock > 0 ? "Disponible para compra" : "Sin stock"}</dd>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="font-semibold text-slate-500">Condicion</dt>
              <dd class="mt-1 text-slate-950">Nuevo / sellado o carta protegida</dd>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="font-semibold text-slate-500">Entrega</dt>
              <dd class="mt-1 text-slate-950">Envio o retiro coordinado</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  `;
};

document.addEventListener("click", (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest("[data-product-variant]") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  const section = button.closest("[data-product-id]");
  const cartButton = section?.querySelector("[data-cart-add]");
  if (!(cartButton instanceof HTMLButtonElement)) return;

  section?.querySelectorAll("[data-product-variant]").forEach((item) => {
    if (!(item instanceof HTMLButtonElement)) return;
    const isActive = item === button;
    item.className = isActive
      ? "rounded-full border px-4 py-2 text-sm font-semibold transition border-slate-950 bg-slate-950 text-white disabled:cursor-not-allowed disabled:opacity-45"
      : "rounded-full border px-4 py-2 text-sm font-semibold transition border-slate-300 bg-white text-slate-700 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-45";
  });

  const stock = Number(button.dataset.variantStock ?? 0);
  cartButton.dataset.cartVariantId = button.dataset.productVariant ?? "";
  cartButton.dataset.cartVariantName = button.dataset.variantName ?? "";
  cartButton.dataset.cartStock = String(stock);
  cartButton.disabled = stock <= 0;
  cartButton.textContent = stock > 0 ? "Agregar al carrito" : "Sin stock";
  const stockLabel = section?.querySelector("[data-product-stock-label]");
  if (stockLabel instanceof HTMLElement) stockLabel.textContent = `Stock ${stock}`;
});

const initProductDetail = async () => {
  productDetailAbortController?.abort();
  productDetailAbortController = new AbortController();
  const signal = productDetailAbortController.signal;
  const config = readConfig();
  const container = document.querySelector("[data-product-detail]");
  if (!(container instanceof HTMLElement)) return;

  const productId = new URLSearchParams(window.location.search).get("id");
  if (!productId) {
    container.innerHTML = `<p class="mx-auto mt-8 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Producto no encontrado.</p>`;
    return;
  }

  try {
    const response = await fetch(`${config.apiBaseUrl ?? "http://localhost:3000"}/api/products/${encodeURIComponent(productId)}`, { signal });
    const payload = await response.json().catch(() => null);
    if (signal.aborted) return;
    if (!response.ok || !payload?.data) throw new Error("Producto no encontrado.");
    container.innerHTML = renderProduct(payload.data);
    document.title = `${payload.data.name} | OnlyCartitas`;
  } catch (error) {
    if (signal.aborted) return;
    container.innerHTML = `<p class="mx-auto mt-8 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(error instanceof Error ? error.message : "Producto no encontrado.")}</p>`;
  }
};

document.addEventListener("astro:page-load", initProductDetail);
initProductDetail();
