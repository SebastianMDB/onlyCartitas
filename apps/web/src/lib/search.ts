export const normalizeSearchText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const readCurrentSearchInputValue = () => {
  if (typeof document === "undefined") return "";
  const input = document.querySelector("[data-search-input]");
  return input instanceof HTMLInputElement ? input.value : "";
};
