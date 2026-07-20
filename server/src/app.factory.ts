import "reflect-metadata";

import { ForbiddenException } from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NextFunction, Request, Response } from "express";
import cookieParser from "cookie-parser";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import { AppModule } from "./app.module";
import { createServerLogger } from "./common/logging/logger.factory";

const resolveCorsOrigin = (): true | string[] => {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  const corsOriginsRaw = process.env.CORS_ORIGINS ?? "";
  const corsOrigins = corsOriginsRaw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (nodeEnv === "production") {
    if (corsOrigins.length === 0) {
      throw new Error("CORS_ORIGINS is required in production");
    }
    return corsOrigins;
  }

  return corsOrigins.length > 0 ? corsOrigins : true;
};

const isForwardedHttps = (value: unknown): boolean => {
  if (typeof value === "string") {
    return value.split(",")[0]?.trim().toLowerCase() === "https";
  }
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    return typeof first === "string" && first.trim().toLowerCase() === "https";
  }
  return false;
};

const registerProductionHttpsEnforcement = (app: INestApplication): void => {
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv !== "production") return;

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.set("trust proxy", 1);
  app.use((request: Request, _: Response, next: NextFunction) => {
    if (request.secure || isForwardedHttps(request.headers["x-forwarded-proto"])) {
      next();
      return;
    }
    next(new ForbiddenException(SharedClientErrorMessage.httpsRequired));
  });
};

export const createApp = async (): Promise<INestApplication> => {
  const app = await NestFactory.create<INestApplication>(AppModule, {
    logger: createServerLogger()
  });
  app.enableShutdownHooks();
  registerProductionHttpsEnforcement(app);
  app.enableCors({ origin: resolveCorsOrigin(), credentials: true });
  app.use(cookieParser());
  await app.init();
  return app;
};
