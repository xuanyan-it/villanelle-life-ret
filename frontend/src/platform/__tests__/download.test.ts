import { describe, expect, test, vi } from "vitest";
import { triggerBlobDownload } from "../download";
describe("triggerBlobDownload", () => {
  test("creates link and triggers download", () => {
    const blob = new Blob(["abc"], { type: "text/plain" });
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:test");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clickSpy = vi.fn();
    const removeSpy = vi.fn();
    const setAttributeSpy = vi.fn();
    const fakeLink = {
      href: "",
      click: clickSpy,
      remove: removeSpy,
      setAttribute: setAttributeSpy,
    } as unknown as HTMLAnchorElement;
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockReturnValue(fakeLink);
    triggerBlobDownload(blob, "a.txt");
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob);
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(fakeLink.href).toBe("blob:test");
    expect(setAttributeSpy).toHaveBeenCalledWith("download", "a.txt");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test");
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
  });
});
