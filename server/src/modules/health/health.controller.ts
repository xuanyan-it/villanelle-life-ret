import { Controller, Get } from "@nestjs/common";

import { Public } from "../../common/http/decorators/public.decorator";

@Controller()
export class HealthController {
  @Public()
  @Get("/health")
  health() {
    return { ok: true };
  }
}
