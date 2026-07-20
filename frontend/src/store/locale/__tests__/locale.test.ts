import { LocaleEnum } from "../../../types";
import { getLocale } from "../selectors";
import reducer, { updateLocale } from "../slice";
describe("locale store", () => {
  test("returns initial state", () => {
    expect(reducer(undefined, { type: "unknown" })).toBe("zh-CN");
  });
  test("updates locale", () => {
    const state = reducer("zh-CN", updateLocale(LocaleEnum.English));
    expect(state).toBe("en-US");
  });
  test("selects locale", () => {
    const rootState = { locale: "en-US" } as any;
    expect(getLocale(rootState)).toBe("en-US");
  });
});
