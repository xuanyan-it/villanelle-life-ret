import { Module } from "@nestjs/common";

import { PersistenceModule } from "../persistence/persistence.module";

import { UserController } from "./user.controller";

@Module({
  imports: [PersistenceModule],
  controllers: [UserController]
})
export class UserModule {}

