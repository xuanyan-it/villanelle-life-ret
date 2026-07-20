import path from "node:path";

import type { MiddlewareConsumer, NestModule } from "@nestjs/common";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, Reflector } from "@nestjs/core";

import { resolveNodeEnv } from "@villanelle/ret-shared/config";

import { AllExceptionsFilter } from "./common/http/filters/all-exceptions.filter";
import { AuthGuard } from "./common/http/guards/auth.guard";
import { LoggingInterceptor } from "./common/http/interceptors/logging.interceptor";
import { RequestIdMiddleware } from "./common/http/middlewares/request-id.middleware";
import { parseServerEnv } from "./config/env";
import { AuthModule } from "./modules/auth/auth.module";
import { DownloadModule } from "./modules/download/download.module";
import { HealthModule } from "./modules/health/health.module";
import { InstituteModule } from "./modules/institute/institute.module";
import { ModelModule } from "./modules/model/model.module";
import { PersistenceModule } from "./modules/persistence/persistence.module";
import { RecordModule } from "./modules/record/record.module";
import { UserModule } from "./modules/user/user.module";

const serverRoot = path.resolve(__dirname, "..");
const nodeEnv = resolveNodeEnv(process.env.NODE_ENV);
const envProfile = nodeEnv === "test" ? "development" : nodeEnv;
const envFilePath = path.join(serverRoot, `.env.${envProfile}`);

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath,
      validate: parseServerEnv
    }),
    PersistenceModule,
    AuthModule,
    HealthModule,
    UserModule,
    InstituteModule,
    ModelModule,
    RecordModule,
    DownloadModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector, configService: ConfigService) =>
        new AuthGuard(reflector, configService),
      inject: [Reflector, ConfigService]
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor
    }
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
