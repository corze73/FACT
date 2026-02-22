/* eslint-env node */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
};

const optionalBool = (name, fallback = false) => {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === 'true';
};

const clean = (value = '') => value.replace(/^\/+|\/+$/g, '');

const getS3Client = () => {
  const region = process.env.S3_REGION || 'us-east-1';
  const endpoint = process.env.S3_ENDPOINT || undefined;

  return new S3Client({
    region,
    endpoint,
    forcePathStyle: optionalBool('S3_FORCE_PATH_STYLE', false),
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY')
    }
  });
};

const normalizeFileName = (fileName = 'upload') => {
  const safe = String(fileName)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || 'upload';
};

const buildPublicUrl = ({ bucket, key }) => {
  const customBase = process.env.S3_PUBLIC_BASE_URL;
  if (customBase) {
    return `${customBase.replace(/\/+$/, '')}/${clean(key)}`;
  }

  const endpoint = process.env.S3_ENDPOINT;
  if (endpoint) {
    return `${endpoint.replace(/\/+$/, '')}/${clean(bucket)}/${clean(key)}`;
  }

  const region = process.env.S3_REGION || 'us-east-1';
  return `https://${bucket}.s3.${region}.amazonaws.com/${clean(key)}`;
};

export async function uploadBuffer({
  buffer,
  contentType,
  fileName,
  prefix = 'compliance'
}) {
  const bucket = required('S3_BUCKET_NAME');
  const client = getS3Client();
  const timestamp = Date.now();
  const key = `${clean(prefix)}/${timestamp}-${normalizeFileName(fileName)}`;

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'private, max-age=31536000'
  }));

  return {
    key,
    url: buildPublicUrl({ bucket, key })
  };
}
