import type { APIRoute } from "astro";
import { GetObjectCommand, NoSuchKey } from "@aws-sdk/client-s3";
import { getB2Bucket, getB2Client } from "../../../lib/backblaze";

export const prerender = false;

type B2Error = Error & {
  $metadata?: {
    httpStatusCode?: number;
  };
};

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

  let bucket = "";

  try {
    bucket = getB2Bucket();
    const file = await getB2Client().send(
      new GetObjectCommand({
        Bucket: bucket,
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
    const b2Error = error as B2Error;
    const statusCode = b2Error.$metadata?.httpStatusCode;
    const errorName = b2Error.name || "BackblazeError";
    const headers = new Headers({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Backblaze-Error": errorName
    });

    console.error("Backblaze image error:", {
      name: errorName,
      message: b2Error.message,
      statusCode,
      bucket,
      key
    });

    if (
      error instanceof NoSuchKey ||
      errorName === "NoSuchKey" ||
      errorName === "NotFound" ||
      statusCode === 404
    ) {
      return new Response("Image not found", { status: 404, headers });
    }

    if (statusCode === 401 || statusCode === 403) {
      return new Response("Backblaze credentials or permissions rejected", {
        status: statusCode,
        headers
      });
    }

    if (errorName === "Error" && b2Error.message.includes(" is required ")) {
      return new Response("Backblaze environment is not configured", { status: 500, headers });
    }

    return new Response("Error loading image", { status: 500, headers });
  }
};
