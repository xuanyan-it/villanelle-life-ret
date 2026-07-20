import type { PipeTransform } from "@nestjs/common";
import { BadRequestException, Injectable } from "@nestjs/common";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";
import type { ZodSchema } from "zod";

@Injectable()
export class ZodValidationPipe<TOutput = unknown> implements PipeTransform<unknown, TOutput> {
  constructor(private readonly schema: ZodSchema<TOutput>) {}

  transform(value: unknown): TOutput {
    const parsed = this.schema.safeParse(value ?? {});
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new BadRequestException(issue?.message ?? SharedClientErrorMessage.invalidPayload);
    }
    return parsed.data;
  }
}
