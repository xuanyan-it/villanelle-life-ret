import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PERSISTENCE_REPOSITORY_TOKEN, RECORD_EVALUATOR_TOKEN } from "../../common/di/tokens";
import { AuthService } from "../auth/auth.service";
import { InstituteService } from "../institute/institute.service";
import { RecordService } from "../record/record.service";
import { PythonRecordEvaluator } from "../record/record-evaluator";
import { UserService } from "../user/user.service";

import { PersistenceLifecycle } from "./persistence.lifecycle";
import { createPersistenceRepository } from "./persistence.repository";

@Module({
  providers: [
    AuthService,
    UserService,
    InstituteService,
    RecordService,
    PersistenceLifecycle,
    {
      provide: PERSISTENCE_REPOSITORY_TOKEN,
      useFactory: (configService: ConfigService) => createPersistenceRepository(configService),
      inject: [ConfigService]
    },
    {
      provide: RECORD_EVALUATOR_TOKEN,
      useClass: PythonRecordEvaluator
    }
  ],
  exports: [PERSISTENCE_REPOSITORY_TOKEN, AuthService, UserService, InstituteService, RecordService]
})
export class PersistenceModule {}

