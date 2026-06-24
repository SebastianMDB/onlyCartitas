import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site, url }) => {
  const origin = site ?? new URL(url.origin);
  const sitemapUrl = new URL("/sitemap.xml", origin).toString();

  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "Disallow: /admin-inventario",
      "Disallow: /checkout",
      "Disallow: /cuenta",
      "Disallow: /login",
      "Disallow: /registro",
      "Disallow: /pago/",
      `Sitemap: ${sitemapUrl}`
    ].join("\n"),
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8"
      }
    }
  );
};
