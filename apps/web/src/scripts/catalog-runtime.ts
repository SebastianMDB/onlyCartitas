type ProductLanguage = "japanese" | "spanish" | "english";
type ProductKind = "sealed" | "single";

type Product = {
  id: string;
  kind: ProductKind;
  name: string;
  category: string;
  set: string;
  language: ProductLanguage;
  stock: number;
  price: number;
  previousPrice?: number | null;
  image: string;
  offer?: string | null;
  illustrator?: string | null;
};

type CatalogConfig = {
  apiBaseUrl?: string;
  kind?: ProductKind;
  offer?: boolean;
  layout?: "products" | "sealed" | "singles" | "offers";
  columns?: "three" | "four";
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

const normalize = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const uniqueValues = (values: Array<string | null | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();

const readConfig = (): CatalogConfig => {
  const configElement = document.querySelector("[data-catalog-config]");
  try {
    return configElement?.textContent ? JSON.parse(configElement.textContent) : {};
  } catch {
    return {};
  }
};

const getProductUrl = (product: Product) => `/producto?id=${encodeURIComponent(product.id)}`;

const renderProductCard = (product: Product, columns: CatalogConfig["columns"] = "three") => {
  const discountPercent =
    product.previousPrice && product.previousPrice > product.price
      ? Math.round(((product.previousPrice - product.price) / product.previousPrice) * 100)
      : null;
  const languageLabel = languageLabels[product.language] ?? product.language;
  const productUrl = getProductUrl(product);
  const titleClass = columns === "four" ? "mt-2 min-h-[3.5rem]" : "mt-2 min-h-[3.5rem]";

  return `
    <article
      class="group flex h-full min-w-0 w-full flex-col overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-[0_20px_45px_rgba(17,48,71,0.08)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(17,48,71,0.14)]"
      data-product-card
      data-product-id="${escapeHtml(product.id)}"
      data-product-name="${escapeHtml(normalize(product.name))}"
      data-product-category="${escapeHtml(normalize(product.category))}"
      data-product-set="${escapeHtml(normalize(product.set))}"
      data-product-language="${escapeHtml(product.language)}"
      data-product-language-label="${escapeHtml(normalize(languageLabel))}"
      data-product-illustrator="${escapeHtml(normalize(product.illustrator))}"
    >
      <a href="${productUrl}" class="relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-[1.4rem] bg-[color:var(--color-surface)]">
        ${
          product.offer
            ? `<span class="absolute left-3 top-3 z-10 rounded-full bg-amber-300 px-3 py-1 text-xs font-semibold text-slate-950 shadow-[0_10px_24px_rgba(0,0,0,0.18)]">${escapeHtml(discountPercent ? `-${discountPercent}%` : product.offer)}</span>`
            : ""
        }
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" width="700" height="900" class="h-full max-h-64 w-full object-contain p-3 transition duration-500 group-hover:scale-[1.03]" loading="lazy" decoding="async" />
      </a>

      <div class="flex flex-1 flex-col justify-between pt-4">
        <div>
          <div class="grid min-h-[4.25rem] gap-2">
            <p class="truncate text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--color-secondary)]">${escapeHtml(product.category)}</p>
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-[color:var(--color-surface)] px-2.5 py-1 text-[11px] font-semibold text-slate-600">${escapeHtml(languageLabel)}</span>
              <span class="rounded-full bg-[color:var(--color-surface)] px-2.5 py-1 text-[11px] font-semibold text-slate-600" data-product-stock-label>Stock ${escapeHtml(product.stock)}</span>
            </div>
          </div>
          <h3 class="${titleClass} text-lg font-semibold leading-snug text-slate-900">
            <a href="${productUrl}" class="transition hover:text-[color:var(--color-secondary)]">${escapeHtml(product.name)}</a>
          </h3>
          <p class="mt-2 min-h-5 truncate text-sm text-slate-500">
            ${escapeHtml(product.set)}${product.illustrator ? ` - ${escapeHtml(product.illustrator)}` : ""}
          </p>

          <div class="mt-4 flex min-h-8 flex-wrap items-baseline gap-x-3 gap-y-1">
            <span class="text-xl font-semibold text-[color:var(--color-primary)]">${currencyFormatter.format(product.price)}</span>
            ${product.previousPrice ? `<span class="text-sm text-slate-400 line-through">${currencyFormatter.format(product.previousPrice)}</span>` : ""}
          </div>
        </div>

        <button
          type="button"
          class="mt-5 inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-full bg-[#071c2b] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_10px_22px_rgba(17,48,71,0.14)] transition hover:bg-[#0d2a3f] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
          data-cart-add
          data-cart-id="${escapeHtml(product.id)}"
          data-cart-name="${escapeHtml(product.name)}"
          data-cart-category="${escapeHtml(product.category)}"
          data-cart-set="${escapeHtml(product.set)}"
          data-cart-language="${escapeHtml(languageLabel)}"
          data-cart-price="${escapeHtml(product.price)}"
          data-cart-stock="${escapeHtml(product.stock)}"
          data-cart-image="${escapeHtml(product.image)}"
          ${product.stock <= 0 ? "disabled" : ""}
        >
          ${product.stock > 0 ? "Agregar al carrito" : "Sin stock"}
        </button>
      </div>
    </article>
  `;
};

const buttonClass = (active: boolean) =>
  active
    ? "rounded-full bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#173b56]"
    : "rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900";

const renderOptions = (select: Element | null, values: string[], placeholder: string) => {
  if (!(select instanceof HTMLSelectElement)) return;
  const currentValue = select.value;
  select.innerHTML = [
    `<option value="all">${escapeHtml(placeholder)}</option>`,
    ...values.map((value) => `<option value="${escapeHtml(normalize(value))}">${escapeHtml(value)}</option>`)
  ].join("");
  select.value = values.some((value) => normalize(value) === currentValue) ? currentValue : "all";
};

const initCatalog = async () => {
  const config = readConfig();
  const apiBaseUrl = config.apiBaseUrl ?? "http://localhost:3000";
  const url = new URL("/api/products", apiBaseUrl);
  if (config.kind) url.searchParams.set("kind", config.kind);
  if (config.offer !== undefined) url.searchParams.set("offer", String(config.offer));

  const grid = document.querySelector("[data-products-grid]");
  const categoryContainer = document.querySelector("[data-category-filters]");
  const setFilter = document.querySelector("[data-set-filter]");
  const illustratorFilter = document.querySelector("[data-illustrator-filter]");
  const languageFilter = document.querySelector("[data-language-filter]");
  const pokemonFilter = document.querySelector("[data-pokemon-filter]");
  const resultsCount = document.querySelector("[data-results-count]");
  const emptyState = document.querySelector("[data-empty-state]");

  if (!(grid instanceof HTMLElement)) return;

  let products: Product[] = [];
  let activeCategory = "all";
  let activeSet = "all";
  let activeIllustrator = "all";
  let activeLanguage = "all";
  let activePokemonQuery = "";
  let activeQuery = "";

  const filteredProducts = () =>
    products.filter((product) => {
      const productName = normalize(product.name);
      const productCategory = normalize(product.category);
      const productSet = normalize(product.set);
      const productIllustrator = normalize(product.illustrator);
      const productLanguage = product.language;
      const productLanguageLabel = normalize(languageLabels[product.language]);

      const matchesQuery =
        activeQuery.length === 0 ||
        productName.includes(activeQuery) ||
        productCategory.includes(activeQuery) ||
        productSet.includes(activeQuery) ||
        productIllustrator.includes(activeQuery) ||
        productLanguage.includes(activeQuery) ||
        productLanguageLabel.includes(activeQuery);
      const matchesPokemon = activePokemonQuery.length === 0 || productName.includes(activePokemonQuery);
      const matchesCategory = activeCategory === "all" || productCategory === activeCategory;
      const matchesSet = activeSet === "all" || productSet === activeSet;
      const matchesIllustrator = activeIllustrator === "all" || productIllustrator === activeIllustrator;
      const matchesLanguage = activeLanguage === "all" || productLanguage === activeLanguage;

      return matchesQuery && matchesPokemon && matchesCategory && matchesSet && matchesIllustrator && matchesLanguage;
    });

  const renderCategories = () => {
    if (!(categoryContainer instanceof HTMLElement)) return;
    const allLabel = config.layout === "offers" ? "Todas" : "Todos";
    const categories = uniqueValues(products.map((product) => product.category));
    categoryContainer.innerHTML = [
      `<button type="button" class="${buttonClass(activeCategory === "all")}" data-category-button data-category="all" aria-pressed="${activeCategory === "all"}">${allLabel}</button>`,
      ...categories.map((category) => {
        const value = normalize(category);
        return `<button type="button" class="${buttonClass(activeCategory === value)}" data-category-button data-category="${escapeHtml(value)}" aria-pressed="${activeCategory === value}">${escapeHtml(category)}</button>`;
      })
    ].join("");
  };

  const renderStats = () => {
    const categories = uniqueValues(products.map((product) => product.category));
    const sets = uniqueValues(products.map((product) => product.set));
    const offers = products.filter((product) => product.offer || product.previousPrice).length;
    const maxDiscount = products.reduce((currentMax, product) => {
      if (!product.previousPrice || product.previousPrice <= product.price) return currentMax;
      return Math.max(currentMax, Math.round(((product.previousPrice - product.price) / product.previousPrice) * 100));
    }, 0);

    document.querySelectorAll("[data-stat]").forEach((element) => {
      if (!(element instanceof HTMLElement)) return;
      const stat = element.dataset.stat;
      if (stat === "sets") element.textContent = String(sets.length);
      if (stat === "products") element.textContent = String(products.length);
      if (stat === "offers") element.textContent = String(offers);
      if (stat === "categories") element.textContent = String(categories.length);
      if (stat === "max-discount") element.textContent = `${maxDiscount}%`;
    });
  };

  const renderGrid = () => {
    const visibleProducts = filteredProducts();
    grid.innerHTML = visibleProducts.map((product) => renderProductCard(product, config.columns)).join("");
    if (resultsCount instanceof HTMLElement) resultsCount.textContent = String(visibleProducts.length);
    if (emptyState instanceof HTMLElement) emptyState.style.display = visibleProducts.length === 0 ? "block" : "none";
  };

  const renderFilters = () => {
    renderCategories();
    renderOptions(setFilter, uniqueValues(products.map((product) => product.set)), "Todos los sets");
    renderOptions(illustratorFilter, uniqueValues(products.map((product) => product.illustrator)), "Todos los ilustradores");
    renderStats();
  };

  categoryContainer?.addEventListener("click", (event) => {
    const target = event.target instanceof HTMLElement ? event.target.closest("[data-category-button]") : null;
    if (!(target instanceof HTMLElement)) return;
    activeCategory = target.dataset.category ?? "all";
    renderCategories();
    renderGrid();
  });

  if (setFilter instanceof HTMLSelectElement) {
    setFilter.addEventListener("change", () => {
      activeSet = setFilter.value;
      renderGrid();
    });
  }

  if (illustratorFilter instanceof HTMLSelectElement) {
    illustratorFilter.addEventListener("change", () => {
      activeIllustrator = illustratorFilter.value;
      renderGrid();
    });
  }

  if (languageFilter instanceof HTMLSelectElement) {
    languageFilter.addEventListener("change", () => {
      activeLanguage = languageFilter.value;
      renderGrid();
    });
  }

  if (pokemonFilter instanceof HTMLInputElement) {
    pokemonFilter.addEventListener("input", () => {
      activePokemonQuery = normalize(pokemonFilter.value);
      renderGrid();
    });
  }

  window.addEventListener("carta-noble:search", (event) => {
    activeQuery = event instanceof CustomEvent && typeof event.detail === "string" ? normalize(event.detail) : "";
    renderGrid();
  });

  try {
    grid.innerHTML = `<p class="col-span-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm font-semibold text-slate-600">Cargando productos...</p>`;
    const response = await fetch(url);
    const payload = await response.json().catch(() => null);
    products = response.ok && Array.isArray(payload?.data) ? payload.data : [];
  } catch {
    products = [];
  }

  renderFilters();
  renderGrid();
};

initCatalog();
