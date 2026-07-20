import { ConfigService } from "@nestjs/config";
import { createSanitizedLogger } from "./common/logging/sanitized-logger";

import { createApp } from "./app.factory";

const bootstrapLogger = createSanitizedLogger("Bootstrap");

void createApp()
  .then((app) => {
    const config = app.get(ConfigService);
    const port = config.get<number>("PORT", 7001);
    const host = config.get<string>("HOST", "0.0.0.0");
    return app.listen(port, host);
  })
  .catch((error: unknown) => {
    bootstrapLogger.error("Application bootstrap failed", error instanceof Error ? error.stack : undefined);
    process.exit(1);
  });
