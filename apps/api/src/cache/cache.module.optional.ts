import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import KeyvRedis, { Keyv } from "@keyv/redis";
import { createCache } from "cache-manager";

/**
 * Optional Cache Module for local development
 * Falls back to in-memory cache if Redis is not available
 */
@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [
    {
      inject: [ConfigService],
      provide: "CACHE_MANAGER",
      useFactory: async (configService: ConfigService) => {
        const redisUrl = configService.get<string>("REDIS_URL");

        // If Redis URL is not configured, use in-memory cache
        if (!redisUrl) {
          console.warn(
            "⚠️  Redis not configured, using in-memory cache (not recommended for production)",
          );
          return createCache({
            stores: [
              // Simple in-memory store for local development
              {
                async get() {
                  return undefined;
                },
                async set() {
                  return;
                },
                async delete() {
                  return;
                },
                async reset() {
                  return;
                },
              },
            ],
          });
        }

        // Use Redis if configured
        try {
          return createCache({
            stores: [
              new Keyv({
                store: new KeyvRedis(redisUrl),
              }),
            ],
          });
        } catch (error) {
          console.error("Failed to connect to Redis, falling back to in-memory cache:", error);
          return createCache({
            stores: [
              {
                async get() {
                  return undefined;
                },
                async set() {
                  return;
                },
                async delete() {
                  return;
                },
                async reset() {
                  return;
                },
              },
            ],
          });
        }
      },
    },
  ],
  exports: ["CACHE_MANAGER"],
})
export class CacheModuleOptional {}
