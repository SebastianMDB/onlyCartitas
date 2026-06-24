import type { APIRoute } from "astro";
import { fetchProducts } from "../lib/catalog";

const pages = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/productos", priority: "0.9", changefreq: "daily" },
  { path: "/sellados", priority: "0.9", changefreq: "daily" },
  { path: "/singles", priority: "0.9", changefreq: "daily" },
  { path: "/ofertas", priority: "0.9", changefreq: "daily" },
  { path: "/ayuda", priority: "0.5", changefreq: "monthly" },
  { path: "/politicas", priority: "0.4", changefreq: "monthly" }
];

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

export const GET: APIRoute = async ({ site, url }) => {
  const origin = site ?? new URL(url.origin);
  const lastmod = new Date().toISOString();
  const products = await fetchProducts();
  const productPages = products
    .filter((product) => product.active !== false)
    .map((product) => ({
      path: `/producto/${product.id}`,
      priority: "0.8",
      changefreq: "daily"
    }));
  const entries = [...pages, ...productPages]
    .map((page) => {
      const loc = new URL(page.path, origin).toString();
      return [
        "  <url>",
        `    <loc>${escapeXml(loc)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${page.changefreq}</changefreq>`,
        `    <priority>${page.priority}</priority>`,
        "  </url>"
      ].join("\n");
    })
    .join("\n");

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
};
