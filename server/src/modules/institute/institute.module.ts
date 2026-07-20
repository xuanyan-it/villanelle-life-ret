import { Module } from "@nestjs/common";

import { PersistenceModule } from "../persistence/persistence.module";

import { InstituteController } from "./institute.controller";

@Module({
  imports: [PersistenceModule],
  controllers: [InstituteController]
})
export class InstituteModule {}

