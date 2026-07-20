import { describe, expect, test, vi } from "vitest";
import { bindWindowDropGuard, isElectronRuntime, subscribeShellOutput } from "../runtime";
describe("runtime helpers", () => {
  test("isElectronRuntime returns false by default", () => {
    delete window.electron;
    expect(isElectronRuntime()).toBe(false);
  });
  test("isElectronRuntime returns true when electron runtime flag exists", () => {
    window.electron = { isElectronRuntime: true };
    expect(isElectronRuntime()).toBe(true);
  });
  test("bindWindowDropGuard installs and removes event listeners", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const unsubscribe = bindWindowDropGuard();
    expect(addSpy).toHaveBeenCalledWith("dragover", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("drop", expect.any(Function));
    unsubscribe();
    expect(removeSpy).toHaveBeenCalledWith("dragover", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("drop", expect.any(Function));
    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
  test("subscribeShellOutput delegates to electron API and returns unsubscribe", () => {
    const unsubscribe = vi.fn();
    window.electron = { isElectronRuntime: true };
    window.electronAPI = {
      call: vi.fn() as any,
      shellOutput: vi.fn(() => unsubscribe),
      isBootstrapRequired: vi.fn() as any,
    } as any;
    const ret = subscribeShellOutput(() => undefined);
    expect(window.electronAPI.shellOutput).toHaveBeenCalledTimes(1);
    ret();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  test("subscribeShellOutput returns noop when shellOutput is unavailable", () => {
    window.electron = { isElectronRuntime: true };
    window.electronAPI = {
      call: vi.fn() as any,
      shellOutput: undefined as any,
      isBootstrapRequired: vi.fn() as any,
    } as any;

    const ret = subscribeShellOutput(() => undefined);

    expect(ret).toEqual(expect.any(Function));
    expect(() => ret()).not.toThrow();
  });

  test("subscribeShellOutput returns noop outside electron runtime", () => {
    delete window.electron;
    const ret = subscribeShellOutput(() => undefined);
    expect(ret).toEqual(expect.any(Function));
    expect(() => ret()).not.toThrow();
  });
});
