import type { APIRoute } from "astro";
import { GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import { getB2Bucket, getB2Client } from "../../../lib/backblaze";

export const prerender = false;

const isSafeImageKey = (key: string) =>
  Boolean(key) &&
  !key.startsWith("/") &&
  !key.includes("\\") &&
  !key
    .split("/")
    .some((part) => part === "" || part === "." || part === "..");

export const GET: APIRoute = async ({ params }) => {
  const key = params.key;

  if (!key || !isSafeImageKey(key)) {
    return new Response("Invalid image key", { status: 400 });
  }

  try {
    const file = await getB2Client().send(
      new GetObjectCommand({
        Bucket: getB2Bucket(),
        Key: key
      })
    );

    if (!file.Body) {
      return new Response("Image not found", { status: 404 });
    }

    const headers = new Headers({
      "Content-Type": file.ContentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
      "X-Content-Type-Options": "nosniff"
    });

    if (file.ETag) headers.set("ETag", file.ETag);
    if (file.LastModified) headers.set("Last-Modified", file.LastModified.toUTCString());
    if (file.ContentLength !== undefined) headers.set("Content-Length", String(file.ContentLength));

    return new Response(file.Body.transformToWebStream(), { headers });
  } catch (error) {
    console.error("Backblaze image error:", error);

    if (error instanceof NoSuchKey || (error instanceof Error && error.name === "NoSuchKey")) {
      return new Response("Image not found", { status: 404 });
    }

    return new Response("Error loading image", { status: 500 });
  }
};
