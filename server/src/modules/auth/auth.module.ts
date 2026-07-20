import { Module } from "@nestjs/common";

import { PersistenceModule } from "../persistence/persistence.module";

import { AuthController } from "./auth.controller";

@Module({
  imports: [PersistenceModule],
  controllers: [AuthController]
})
export class AuthModule {}
