import { describe, expect, test } from "bun:test";
import { jumpScript } from "../src/jump-ui";

type BootCache = { query: string; testament: string; hits?: unknown[] } | null;

type Harness = {
  boot: () => void;
  form: { submitted: number; dataset: { jumpBound?: string } };
  input: { value: string };
  clearBtn: { hidden: boolean };
  order: string[];
};

function loadBoot(): (
  document: { querySelectorAll: (sel: string) => unknown[] },
  location: { href: string },
  readSearchCache: () => BootCache,
  normalizeTestament: (value: string) => string,
  syncTestamentFromStorage: () => void,
  ensureSearchModal: () => void,
  revealCachedSearch: () => boolean,
  openSearchModal: () => void,
  searchTestament: string,
) => () => void {
  const source = jumpScript();
  const boot = source.slice(source.indexOf("function bootSearchQuery"), source.indexOf("function bindAll"));
  return new Function(
    "document",
    "location",
    "readSearchCache",
    "normalizeTestament",
    "syncTestamentFromStorage",
    "ensureSearchModal",
    "revealCachedSearch",
    "openSearchModal",
    "searchTestament",
    `${boot}
    return bootSearchQuery;`,
  ) as ReturnType<typeof loadBoot>;
}

function harness(options: {
  href?: string;
  bound?: boolean;
  hasInput?: boolean;
  cache?: BootCache;
  testament?: string;
  reveal?: boolean;
}): Harness {
  const order: string[] = [];
  const input = { value: "" };
  const clearBtn = { hidden: true };
  const form = {
    dataset: { jumpBound: options.bound === false ? undefined : "1" } as { jumpBound?: string },
    offsetParent: {},
    submitted: 0,
    requestSubmit() {
      order.push("submit");
      this.submitted += 1;
    },
    querySelector(sel: string) {
      if (options.hasInput === false) return null;
      if (sel.includes("jump-clear")) return clearBtn;
      if (sel.includes("search")) return input;
      return null;
    },
  };
  const document = {
    querySelectorAll(sel: string) {
      return sel === "form.jump" ? [form] : [];
    },
  };
  const boot = loadBoot()(
    document,
    { href: options.href ?? "https://margin.test/jhn.1?q=God+so+loved+the+world" },
    () => options.cache ?? null,
    (value: string) => (value === "nt" || value === "ot" ? value : "all"),
    () => {
      order.push("sync");
    },
    () => {
      order.push("ensure");
    },
    () => {
      order.push("reveal");
      return options.reveal !== false;
    },
    () => {
      order.push("open");
    },
    options.testament ?? "all",
  );
  return { boot, form, input, clearBtn, order };
}

describe("bootSearchQuery from a q-only URL", () => {
  test("submits the header form once when nothing is cached", () => {
    const page = harness({});
    expect(() => page.boot()).not.toThrow();
    expect(page.input.value).toBe("God so loved the world");
    expect(page.clearBtn.hidden).toBe(false);
    expect(page.form.submitted).toBe(1);
    expect(page.order).toEqual(["sync", "submit"]);
  });

  test("opens the cached overlay once and does not submit again", () => {
    const page = harness({
      cache: { query: "God so loved the world", testament: "all", hits: [{ label: "John 3:16" }] },
    });
    page.boot();
    expect(page.form.submitted).toBe(0);
    expect(page.order).toEqual(["sync", "ensure", "reveal"]);
  });

  test("opens the overlay when a matching cache cannot be painted", () => {
    const page = harness({
      cache: { query: "God so loved the world", testament: "all" },
      reveal: false,
    });
    page.boot();
    expect(page.form.submitted).toBe(0);
    expect(page.order).toEqual(["sync", "ensure", "reveal", "open"]);
  });

  test("submits when the cached query or testament does not match", () => {
    const otherQuery = harness({
      cache: { query: "love your neighbor", testament: "all" },
    });
    otherQuery.boot();
    expect(otherQuery.form.submitted).toBe(1);
    expect(otherQuery.order).toEqual(["sync", "submit"]);

    const otherTestament = harness({
      cache: { query: "God so loved the world", testament: "ot" },
      testament: "nt",
    });
    otherTestament.boot();
    expect(otherTestament.form.submitted).toBe(1);
    expect(otherTestament.order).toEqual(["sync", "submit"]);
  });

  test("does nothing without a query, a bound form, or an input", () => {
    const empty = harness({ href: "https://margin.test/jhn.1" });
    empty.boot();
    expect(empty.form.submitted).toBe(0);
    expect(empty.order).toEqual(["sync"]);

    const unbound = harness({ bound: false });
    unbound.boot();
    expect(unbound.form.submitted).toBe(0);
    expect(unbound.input.value).toBe("");

    const noInput = harness({ hasInput: false });
    noInput.boot();
    expect(noInput.form.submitted).toBe(0);
    expect(noInput.order).toEqual(["sync"]);
  });

  test("a reference query still goes through the same submit", () => {
    const page = harness({ href: "https://margin.test/jhn.1?q=John+3%3A16" });
    page.boot();
    expect(page.input.value).toBe("John 3:16");
    expect(page.form.submitted).toBe(1);
    expect(page.order.filter((step) => step === "submit")).toEqual(["submit"]);
  });
});
