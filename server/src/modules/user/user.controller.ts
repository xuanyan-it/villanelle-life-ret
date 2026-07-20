import { Body, ConflictException, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import { SharedClientErrorMessage } from "@villanelle/ret-shared/contracts";

import {
  type ServerUserDeleteRequest,
  type ServerUserListRequest,
  ServerUserDeleteRequestSchema,
  ServerUserListRequestSchema
} from "../../contracts/request.schemas";
import {
  ServerDeleteSuccessEnvelopeSchema,
  ServerUserQuerySchema
} from "../../contracts/response.schemas";

import { ok } from "../../common/envelope/response";
import { ZodValidationPipe } from "../../common/http/pipes/zod-validation.pipe";

import { UserService } from "./user.service";

type UserDeleteBody = ServerUserDeleteRequest;
type UserListBody = ServerUserListRequest;

@Controller("/api/user")
export class UserController {
  constructor(@Inject(UserService) private readonly userService: UserService) {}

  @Post("/delete")
  @HttpCode(200)
  async userDelete(@Body(new ZodValidationPipe(ServerUserDeleteRequestSchema)) body: UserDeleteBody) {
    const uuids = body.map((item) => item.uuid);
    const deleted = await this.userService.deleteUsers(uuids);
    if (!deleted) {
      throw new ConflictException(SharedClientErrorMessage.deleteFailed);
    }
    return ok(true, "", ServerDeleteSuccessEnvelopeSchema.shape.payload.element);
  }

  @Post("/list")
  @HttpCode(200)
  async userList(@Body(new ZodValidationPipe(ServerUserListRequestSchema)) body: UserListBody) {
    return ok(await this.userService.listUsers(body), "", ServerUserQuerySchema);
  }

}

