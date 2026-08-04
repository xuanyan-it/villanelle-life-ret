import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createLocalUploadStore } from "../localUploadStore";

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) =>
      fs.rm(root, { recursive: true, force: true }),
    ),
  );
});

describe("local upload store", () => {
  it("assembles an uploaded slide and exposes a generated heatmap", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ret-upload-test-"));
    temporaryRoots.push(root);
    const store = createLocalUploadStore(root);
    const content = new Uint8Array([1, 2, 3, 4]);

    const upload = await store.init("tester", "sample.svs", content.byteLength);
    await store.writeChunk("tester", upload.uploadId, 0, content);
    await store.complete("tester", upload.uploadId);

    const slidePath = await store.slidePath(
      "tester",
      upload.uploadId,
      "sample.svs",
    );
    await expect(fs.readFile(slidePath)).resolves.toEqual(Buffer.from(content));

    const outputDir = path.join(root, upload.uploadId, "output");
    await fs.mkdir(outputDir, { recursive: true });
    await fs.writeFile(path.join(outputDir, "heatmap.png"), Buffer.from("png"));
    await fs.writeFile(path.join(outputDir, "slide_preview.png"), Buffer.from("svs"));
    await expect(
      store.heatmapDataUrl("tester", upload.uploadId),
    ).resolves.toBe("data:image/png;base64,cG5n");
    await expect(
      store.slidePreviewDataUrl("tester", upload.uploadId),
    ).resolves.toBe("data:image/png;base64,c3Zz");
  });
});
