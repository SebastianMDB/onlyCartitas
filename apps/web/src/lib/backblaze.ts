import { S3Client } from "@aws-sdk/client-s3";

const requiredEnv = (name: string) => {
  const value = import.meta.env[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required to read images from Backblaze B2`);
  }

  return value.trim();
};

let b2Client: S3Client | undefined;

export const getB2Bucket = () => requiredEnv("B2_BUCKET");

export const getB2Client = () => {
  b2Client ??= new S3Client({
    endpoint: requiredEnv("B2_ENDPOINT"),
    region: requiredEnv("B2_REGION"),
    credentials: {
      accessKeyId: requiredEnv("B2_KEY_ID"),
      secretAccessKey: requiredEnv("B2_APPLICATION_KEY")
    }
  });

  return b2Client;
};
