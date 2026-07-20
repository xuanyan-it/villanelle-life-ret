import { Module } from "@nestjs/common";

import { ModelController } from "./model.controller";
import { ModelStrictService } from "./model-strict.service";

@Module({
  controllers: [ModelController],
  providers: [ModelStrictService]
})
export class ModelModule {}
