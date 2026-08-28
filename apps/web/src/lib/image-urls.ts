type SupabaseTransformOptions = {
  width?: number;
  height?: number;
  quality?: number;
  resize?: "cover" | "contain" | "fill";
};

const SUPABASE_OBJECT_PUBLIC_PATH = "/storage/v1/object/public/";
const SUPABASE_RENDER_PUBLIC_PATH = "/storage/v1/render/image/public/";
const TRANSFORMED_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif", "gif"]);

const isSupabaseStorageUrl = (url: URL) =>
  url.hostname.endsWith(".supabase.co") &&
  (url.pathname.includes(SUPABASE_OBJECT_PUBLIC_PATH) || url.pathname.includes(SUPABASE_RENDER_PUBLIC_PATH));

const canTransformPath = (pathname: string) => {
  const extension = pathname.split(".").pop()?.toLowerCase();
  return extension ? TRANSFORMED_IMAGE_EXTENSIONS.has(extension) : false;
};

const normalizeNumber = (value: number | undefined, min: number, max: number) => {
  if (!Number.isFinite(value)) return undefined;
  return Math.min(max, Math.max(min, Math.round(value as number)));
};

export const getSupabaseImageUrl = (value: string, options: SupabaseTransformOptions = {}) => {
  const imageTransformationsEnabled = import.meta.env.PUBLIC_SUPABASE_IMAGE_TRANSFORMS_ENABLED === "true";
  if (!imageTransformationsEnabled) return value;

  try {
    const url = new URL(value);
    if (!isSupabaseStorageUrl(url) || !canTransformPath(url.pathname)) return value;

    url.pathname = url.pathname.replace(SUPABASE_OBJECT_PUBLIC_PATH, SUPABASE_RENDER_PUBLIC_PATH);

    const width = normalizeNumber(options.width, 1, 2500);
    const height = normalizeNumber(options.height, 1, 2500);
    const quality = normalizeNumber(options.quality, 20, 100);
    if (width) url.searchParams.set("width", String(width));
    if (height) url.searchParams.set("height", String(height));
    if (quality) url.searchParams.set("quality", String(quality));
    if (options.resize) url.searchParams.set("resize", options.resize);

    return url.toString();
  } catch {
    return value;
  }
};

export const getProductCardImageUrl = (value: string) =>
  getSupabaseImageUrl(value, {
    width: 700,
    quality: 72,
    resize: "contain"
  });

export const getProductDetailImageUrl = (value: string) =>
  getSupabaseImageUrl(value, {
    width: 1100,
    quality: 78,
    resize: "contain"
  });

export const getHeroImageUrl = (value: string) =>
  getSupabaseImageUrl(value, {
    width: 1600,
    quality: 74,
    resize: "cover"
  });
