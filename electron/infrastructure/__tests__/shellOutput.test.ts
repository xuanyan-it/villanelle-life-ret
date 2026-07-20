import { describe, expect, test, vi } from "vitest";

import { createShellOutputEmitter } from "../shellOutput";

describe("createShellOutputEmitter", () => {
  test("sends payload when window exists and is not destroyed", () => {
    const send = vi.fn();
    const windowMock = {
      isDestroyed: () => false,
      webContents: {
        send,
      },
    };
    const emit = createShellOutputEmitter(() => windowMock as any);

    emit("hello");

    expect(send).toHaveBeenCalledWith("shellOutput", "hello");
  });

  test("does not send when window is missing or destroyed", () => {
    const send = vi.fn();
    const destroyedWindow = {
      isDestroyed: () => true,
      webContents: {
        send,
      },
    };

    const emitWhenMissing = createShellOutputEmitter(() => undefined);
    emitWhenMissing("x");

    const emitWhenDestroyed = createShellOutputEmitter(
      () => destroyedWindow as any,
    );
    emitWhenDestroyed("y");

    expect(send).not.toHaveBeenCalled();
  });
});
