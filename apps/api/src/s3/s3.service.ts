import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Injectable, Inject } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Cache } from "cache-manager";

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private readonly bucketName: string;
  private readonly CACHE_TTL = 3000; // 50 minutes (signed URLs valid for 1 hour)

  constructor(
    private configService: ConfigService,
    @Inject("CACHE_MANAGER") private cacheManager: Cache,
  ) {
    const config = this.loadS3Config();

    this.s3Client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,
      ...(config.endpoint && { endpoint: config.endpoint }),
    });

    this.bucketName = config.bucketName;

    if (!this.s3Client) {
      throw new Error("S3 client is not initialized. Please check your configuration.");
    }
  }

  private loadS3Config() {
    const s3Config = this.getS3Config("s3.S3");
    if (this.isValidS3Config(s3Config)) {
      return s3Config;
    }

    const awsConfig = this.getS3Config("aws.AWS");
    return awsConfig;
  }

  private getS3Config(prefix: string) {
    return {
      endpoint: this.configService.get<string>(`${prefix}_ENDPOINT`) || "",
      region: this.configService.get<string>(`${prefix}_REGION`) || "us-east-1",
      accessKeyId: this.configService.get<string>(`${prefix}_ACCESS_KEY_ID`) || "",
      secretAccessKey: this.configService.get<string>(`${prefix}_SECRET_ACCESS_KEY`) || "",
      bucketName: this.configService.get<string>(`${prefix}_BUCKET_NAME`) || "",
    };
  }

  private isValidS3Config(config: {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
  }): boolean {
    return !!(
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.bucketName &&
      config.endpoint
    );
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (!key) {
      return "";
    }

    // Check cache first
    const cacheKey = `s3:signed-url:${key}`;
    const cachedUrl = await this.cacheManager.get<string>(cacheKey);

    if (cachedUrl) {
      return cachedUrl;
    }

    // Generate new signed URL
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

    // Cache the signed URL (with TTL slightly less than expiry)
    await this.cacheManager.set(cacheKey, signedUrl, this.CACHE_TTL);

    return signedUrl;
  }

  /**
   * Batch get signed URLs for multiple keys (optimized with caching)
   * Reduces N+1 query problems when fetching multiple S3 URLs
   */
  async getSignedUrls(keys: string[], expiresIn: number = 3600): Promise<Record<string, string>> {
    const result: Record<string, string> = {};

    // Filter out empty keys
    const validKeys = keys.filter((key) => key && key.trim());

    if (validKeys.length === 0) {
      return result;
    }

    // Check cache for all keys first
    const cacheKeys = validKeys.map((key) => `s3:signed-url:${key}`);
    const cachedUrls = await Promise.all(
      cacheKeys.map((cacheKey) => this.cacheManager.get<string>(cacheKey)),
    );

    // Identify which keys need to be generated
    const keysToGenerate: string[] = [];
    validKeys.forEach((key, index) => {
      if (cachedUrls[index]) {
        result[key] = cachedUrls[index]!;
      } else {
        keysToGenerate.push(key);
      }
    });

    // Generate signed URLs for uncached keys in parallel
    if (keysToGenerate.length > 0) {
      const newUrls = await Promise.all(
        keysToGenerate.map(async (key) => {
          const command = new GetObjectCommand({
            Bucket: this.bucketName,
            Key: key,
          });
          const signedUrl = await getSignedUrl(this.s3Client, command, { expiresIn });

          // Cache the new URL
          const cacheKey = `s3:signed-url:${key}`;
          await this.cacheManager.set(cacheKey, signedUrl, this.CACHE_TTL);

          return { key, signedUrl };
        }),
      );

      // Add newly generated URLs to result
      newUrls.forEach(({ key, signedUrl }) => {
        result[key] = signedUrl;
      });
    }

    return result;
  }

  async getFileContent(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    const response = await this.s3Client.send(command);
    return response.Body?.transformToString() || "";
  }

  async uploadFile(fileBuffer: Buffer, key: string, contentType: string): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }
}
