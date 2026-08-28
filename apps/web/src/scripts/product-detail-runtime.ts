import { getProductDetailImageUrl } from "../lib/image-urls";

type ProductLanguage = "japanese" | "spanish" | "english";
type Product = {
  id: string;
  kind: "sealed" | "single";
  name: string;
  category: string;
  description?: string | null;
  set: string;
  language: ProductLanguage;
  stock: number;
  variants?: Array<{ id: string; name: string; stock: number; active: boolean }> | null;
  price: number;
  previousPrice?: number | null;
  image: string;
  offer?: string | null;
  illustrator?: string | null;
  active?: boolean;
  manualSegment?: string | null;
};

type DesignChoice = {
  id: string;
  label: string;
  productId: string;
  productName: string;
  stock: number;
  image: string;
  variantId?: string;
  variantName?: string;
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

const readInventoryState = () => {
  try {
    const storedInventory = window.localStorage.getItem("onlycartitas-inventory-state");
    return storedInventory ? JSON.parse(storedInventory) : {};
  } catch {
    return {};
  }
};

const hasVariants = (product: Product) => Array.isArray(product.variants) && product.variants.length > 0;

const withInventoryVariants = (product: Product): Product => {
  if (hasVariants(product)) return product;
  const inventoryState = readInventoryState();
  const variants = inventoryState?.[product.id]?.variants;
  return Array.isArray(variants) && variants.length > 0 ? { ...product, variants } : product;
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const getBaseProductName = (value: unknown) =>
  normalizeText(value)
    .replace(/\s+[-|/]\s+.+$/, "")
    .replace(/\s+\(.+\)$/, "")
    .trim();

const getDesignLabel = (baseProduct: Product, product: Product) => {
  if (product.manualSegment) return product.manualSegment;
  const productName = String(product.name ?? "").trim();
  const normalizedBaseName = normalizeText(baseProduct.name);
  const normalizedProductName = normalizeText(productName);
  if (normalizedProductName.startsWith(normalizedBaseName)) {
    const suffix = productName.slice(baseProduct.name.length).replace(/^[\s\-|/()]+|[\s\-|/()]+$/g, "").trim();
    if (suffix) return suffix;
  }
  return productName;
};

const designChoiceClass = (active: boolean) =>
  [
    "grid min-h-[4.25rem] min-w-[9rem] flex-1 rounded-2xl border px-4 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45",
    active
      ? "border-slate-950 bg-slate-950 text-white shadow-[0_14px_34px_rgba(17,48,71,0.18)]"
      : "border-slate-300 bg-white text-slate-700 hover:border-slate-500 hover:text-slate-950"
  ].join(" ");

const findSiblingDesignChoices = (product: Product, products: Product[]): DesignChoice[] => {
  const baseName = getBaseProductName(product.name);
  if (!baseName) return [];

  const matches = products.filter((candidate) => {
    if (candidate.active === false) return false;
    return (
      candidate.kind === product.kind &&
      normalizeText(candidate.category) === normalizeText(product.category) &&
      normalizeText(candidate.set) === normalizeText(product.set) &&
      normalizeText(candidate.language) === normalizeText(product.language) &&
      Number(candidate.price) === Number(product.price) &&
      getBaseProductName(candidate.name) === baseName
    );
  });

  const uniqueMatches = Array.from(new Map(matches.map((candidate) => [candidate.id, candidate])).values());
  if (uniqueMatches.length <= 1) return [];

  return uniqueMatches.map((candidate) => ({
    id: candidate.id,
    label: getDesignLabel(product, candidate),
    productId: candidate.id,
    productName: candidate.name,
    stock: Number(candidate.stock ?? 0),
    image: candidate.image
  }));
};

let productDetailAbortController: AbortController | null = null;

const renderProduct = (product: Product, siblingDesignChoices: DesignChoice[] = []) => {
  const languageLabel = languageLabels[product.language] ?? product.language;
  const variants = Array.isArray(product.variants) ? product.variants.filter((variant) => variant.active !== false) : [];
  const variantDesignChoices: DesignChoice[] = variants.map((variant) => ({
    id: variant.id,
    label: variant.name,
    productId: product.id,
    productName: product.name,
    stock: Number(variant.stock ?? 0),
    image: product.image,
    variantId: variant.id,
    variantName: variant.name
  }));
  const designChoices = variantDesignChoices.length > 0 ? variantDesignChoices : siblingDesignChoices;
  const selectedChoice = designChoices.find((choice) => choice.stock > 0) ?? designChoices[0] ?? null;
  const selectedStock = selectedChoice ? selectedChoice.stock : product.stock;
  const selectedCartProductId = selectedChoice?.productId ?? product.id;
  const selectedCartProductName = selectedChoice?.productName ?? product.name;
  const selectedCartImage = selectedChoice?.image ?? product.image;
  const selectedCartVariantId = selectedChoice?.variantId ?? "";
  const selectedCartVariantName = selectedChoice?.variantName ?? (siblingDesignChoices.length > 0 ? selectedChoice?.label ?? "" : "");
  const productImage = getProductDetailImageUrl(product.image);
  const discountPercent =
    product.previousPrice && product.previousPrice > product.price
      ? Math.round(((product.previousPrice - product.price) / product.previousPrice) * 100)
      : null;

  return `
    <section class="mx-auto grid w-full max-w-7xl gap-8 px-4 pt-8 sm:px-6 lg:grid-cols-[minmax(0,540px)_1fr] lg:px-8" data-product-id="${escapeHtml(product.id)}">
      <div class="rounded-[2rem] border border-slate-200/80 bg-white/90 p-4 shadow-[0_20px_60px_rgba(17,48,71,0.08)] lg:sticky lg:top-28 lg:self-start">
        <div class="relative flex aspect-square items-center justify-center rounded-[1.6rem] bg-[color:var(--color-surface)] p-5">
          ${discountPercent ? `<span class="absolute left-5 top-5 rounded-full bg-amber-300 px-3 py-1 text-sm font-semibold text-slate-950">-${discountPercent}%</span>` : ""}
          <img src="${escapeHtml(productImage)}" alt="${escapeHtml(product.name)}" class="h-full w-full object-contain" width="900" height="1100" loading="eager" decoding="async" fetchpriority="high" />
        </div>
      </div>

      <div class="flex flex-col gap-6">
        <div class="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(17,48,71,0.08)] sm:p-7">
          <p class="text-xs font-semibold uppercase tracking-[0.24em] text-[color:var(--color-secondary)]">${escapeHtml(product.category)}</p>
          <h1 class="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--color-primary)] sm:text-5xl">${escapeHtml(product.name)}</h1>
          <p class="mt-4 text-base leading-7 text-slate-600">
            ${escapeHtml(product.description || `Producto del set ${product.set}, disponible en idioma ${languageLabel}. Ideal para colección, juego o reposición de inventario.`)}
          </p>

          <div class="mt-6 grid gap-3 sm:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Stock</p>
              <p class="mt-2 text-2xl font-semibold text-[color:var(--color-primary)]" data-product-stock-label>${escapeHtml(selectedStock)}</p>
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

          <div class="mt-7 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Precio</p>
            <div class="mt-2 flex flex-wrap items-end gap-3">
              <p class="text-4xl font-semibold text-[color:var(--color-primary)]">${currencyFormatter.format(product.price)}</p>
              ${product.previousPrice ? `<p class="pb-1 text-lg text-slate-400 line-through">${currencyFormatter.format(product.previousPrice)}</p>` : ""}
            </div>
          </div>

          ${
            designChoices.length
              ? `<div class="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4" data-variant-picker>
                  <div class="mb-3 flex items-center justify-between gap-3">
                    <p class="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Dise&ntilde;o</p>
                    <p class="text-xs font-medium text-slate-500">${designChoices.length} opciones</p>
                  </div>
                  <div class="grid gap-2 sm:grid-cols-2">
                    ${designChoices
                      .map(
                        (choice) =>
                          `<button type="button" class="${designChoiceClass(choice.id === selectedChoice?.id)}" data-design-choice="${escapeHtml(choice.id)}" data-choice-product-id="${escapeHtml(choice.productId)}" data-choice-product-name="${escapeHtml(choice.productName)}" data-choice-stock="${escapeHtml(choice.stock)}" data-choice-image="${escapeHtml(choice.image)}" data-choice-variant-id="${escapeHtml(choice.variantId ?? "")}" data-choice-variant-name="${escapeHtml(choice.variantName ?? (siblingDesignChoices.length > 0 ? choice.label : ""))}" aria-pressed="${choice.id === selectedChoice?.id}" ${choice.stock <= 0 ? "disabled" : ""}>
                            <span class="text-sm font-semibold leading-snug">${escapeHtml(choice.label)}</span>
                            <span class="mt-1 text-xs font-medium opacity-75">${choice.stock > 0 ? `${escapeHtml(choice.stock)} disponibles` : "Sin stock"}</span>
                          </button>`
                      )
                      .join("")}
                  </div>
                </div>`
              : ""
          }

          <button
            type="button"
            class="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#071c2b] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(17,48,71,0.18)] transition hover:bg-[#0d2a3f] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
            data-cart-add
            data-cart-id="${escapeHtml(selectedCartProductId)}"
            data-cart-name="${escapeHtml(selectedCartProductName)}"
            data-cart-category="${escapeHtml(product.category)}"
            data-cart-set="${escapeHtml(product.set)}"
            data-cart-language="${escapeHtml(languageLabel)}"
            data-cart-price="${escapeHtml(product.price)}"
            data-cart-stock="${escapeHtml(selectedStock)}"
            data-cart-variant-id="${escapeHtml(selectedCartVariantId)}"
            data-cart-variant-name="${escapeHtml(selectedCartVariantName)}"
            data-cart-image="${escapeHtml(selectedCartImage)}"
            ${selectedStock <= 0 ? "disabled" : ""}
          >
            ${selectedStock > 0 ? "Agregar al carrito" : "Sin stock"}
          </button>
        </div>

        <div class="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-[0_20px_60px_rgba(17,48,71,0.08)] sm:p-7">
          <h2 class="text-xl font-semibold text-[color:var(--color-primary)]">Ficha técnica</h2>
          <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="font-semibold text-slate-500">Categoría</dt>
              <dd class="mt-1 text-slate-950">${escapeHtml(product.category)}</dd>
            </div>
            <div class="rounded-2xl bg-slate-50 p-4">
              <dt class="font-semibold text-slate-500">Condición</dt>
              <dd class="mt-1 text-slate-950">${product.kind === "sealed" ? "Producto sellado" : "Carta protegida"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  `;
};

document.addEventListener("click", (event) => {
  const button = event.target instanceof HTMLElement ? event.target.closest("[data-design-choice]") : null;
  if (!(button instanceof HTMLButtonElement)) return;
  const section = button.closest("[data-product-id]");
  const cartButton = section?.querySelector("[data-cart-add]");
  if (!(cartButton instanceof HTMLButtonElement)) return;

  section?.querySelectorAll("[data-design-choice]").forEach((item) => {
    if (!(item instanceof HTMLButtonElement)) return;
    const isActive = item === button;
    item.className = designChoiceClass(isActive);
    item.setAttribute("aria-pressed", isActive ? "true" : "false");
  });

  const stock = Number(button.dataset.choiceStock ?? 0);
  cartButton.dataset.cartId = button.dataset.choiceProductId ?? "";
  cartButton.dataset.cartName = button.dataset.choiceProductName ?? "";
  cartButton.dataset.cartVariantId = button.dataset.choiceVariantId ?? "";
  cartButton.dataset.cartVariantName = button.dataset.choiceVariantName ?? "";
  cartButton.dataset.cartImage = button.dataset.choiceImage ?? "";
  cartButton.dataset.cartStock = String(stock);
  cartButton.disabled = stock <= 0;
  cartButton.textContent = stock > 0 ? "Agregar al carrito" : "Sin stock";
  const stockLabel = section?.querySelector("[data-product-stock-label]");
  if (stockLabel instanceof HTMLElement) stockLabel.textContent = String(stock);
});

const initProductDetail = async () => {
  productDetailAbortController?.abort();
  productDetailAbortController = new AbortController();
  const signal = productDetailAbortController.signal;
  const config = readConfig();
  const container = document.querySelector("[data-product-detail]");
  if (!(container instanceof HTMLElement)) return;

  const productId =
    new URLSearchParams(window.location.search).get("id") ??
    container.dataset.productId ??
    decodeURIComponent(window.location.pathname.split("/").filter(Boolean).pop() ?? "");
  if (!productId) {
    container.innerHTML = `<p class="mx-auto mt-8 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">Producto no encontrado.</p>`;
    return;
  }

  try {
    const apiBaseUrl = config.apiBaseUrl ?? "http://localhost:3000";
    const response = await fetch(`${apiBaseUrl}/api/products/${encodeURIComponent(productId)}`, { signal });
    const payload = await response.json().catch(() => null);
    if (signal.aborted) return;
    if (!response.ok || !payload?.data) throw new Error("Producto no encontrado.");
    let product = withInventoryVariants(payload.data);
    let siblingDesignChoices: DesignChoice[] = [];
    if (!hasVariants(product)) {
      const listResponse = await fetch(`${apiBaseUrl}/api/products?includeInactive=true`, { signal });
      const listPayload = await listResponse.json().catch(() => null);
      const products = Array.isArray(listPayload?.data) ? listPayload.data : [];
      const matchingProduct = products.find((item: Product) => item.id === product.id);
      if (matchingProduct && hasVariants(matchingProduct)) product = matchingProduct;
      siblingDesignChoices = hasVariants(product) ? [] : findSiblingDesignChoices(product, products);
    }
    container.innerHTML = renderProduct(product, siblingDesignChoices);
    document.title = `${product.name} | OnlyCartitas`;
  } catch (error) {
    if (signal.aborted) return;
    container.innerHTML = `<p class="mx-auto mt-8 max-w-3xl rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">${escapeHtml(error instanceof Error ? error.message : "Producto no encontrado.")}</p>`;
  }
};

let lastProductDetailInitUrl = "";
let lastProductDetailInitAt = 0;

const scheduleProductDetailInit = () => {
  const currentUrl = window.location.href;
  const now = Date.now();
  if (currentUrl === lastProductDetailInitUrl && now - lastProductDetailInitAt < 500) return;
  lastProductDetailInitUrl = currentUrl;
  lastProductDetailInitAt = now;
  void initProductDetail();
};

document.addEventListener("astro:page-load", scheduleProductDetailInit);
if (document.readyState !== "loading") scheduleProductDetailInit();
