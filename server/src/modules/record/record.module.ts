import { Module } from "@nestjs/common";

import { PersistenceModule } from "../persistence/persistence.module";

import { RecordController } from "./record.controller";

@Module({
  imports: [PersistenceModule],
  controllers: [RecordController]
})
export class RecordModule {}

