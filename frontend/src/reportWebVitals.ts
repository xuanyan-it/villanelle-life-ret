type PerfHandler = (metric: unknown) => void;
const reportWebVitals = (onPerfEntry?: PerfHandler): void => {
  if (!(onPerfEntry instanceof Function)) return;
  import("web-vitals").then((metrics: Record<string, unknown>) => {
    const run = (name: string): void => {
      const fn = metrics[name];
      if (typeof fn === "function") {
        (fn as (cb: PerfHandler) => void)(onPerfEntry);
      }
    };
    // Compatible with both legacy and newer web-vitals APIs.
    run("getCLS");
    run("getFID");
    run("getFCP");
    run("getLCP");
    run("getTTFB");
    run("onCLS");
    run("onFID");
    run("onFCP");
    run("onLCP");
    run("onTTFB");
  });
};
export default reportWebVitals;
