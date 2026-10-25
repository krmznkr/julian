import { describe, expect, it } from "vitest";
import { SHARE_IMAGE, siteOrigin, withShareMeta, withTitle } from "./share";

const page = `<head>
    <meta
      name="description"
      content="Your whole year &amp; nothing else."
    />
    <!-- @share -->
    <title>Julian · "Year" &amp; more</title>
  </head>`;

const content = (html: string, key: string) =>
  new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)" />`).exec(html)?.[1];

describe("siteOrigin", () => {
  it("points nightly builds at the nightly host and everything else at stable", () => {
    expect(siteOrigin("nightly")).toBe("https://julian-nightly.krmznkr.com");
    expect(siteOrigin("stable")).toBe("https://julian.krmznkr.com");
    expect(siteOrigin("preview")).toBe("https://julian.krmznkr.com");
    expect(siteOrigin("dev")).toBe("https://julian.krmznkr.com");
  });
});

describe("withShareMeta", () => {
  const origin = "https://julian.krmznkr.com";

  it("repeats the page's own title and description as preview tags", () => {
    const html = withShareMeta(page, { origin, path: "/" });
    expect(html).not.toContain("@share");
    expect(content(html, "og:title")).toBe("Julian · &quot;Year&quot; &amp; more");
    expect(content(html, "og:description")).toBe("Your whole year &amp; nothing else.");
    expect(content(html, "og:type")).toBe("website");
    expect(content(html, "og:url")).toBe("https://julian.krmznkr.com/");
    expect(content(html, "twitter:card")).toBe("summary_large_image");
  });

  it("links an absolute, sized image on the build's origin", () => {
    const html = withShareMeta(page, { origin: "https://julian-nightly.krmznkr.com" });
    expect(content(html, "og:image")).toBe("https://julian-nightly.krmznkr.com/og-image.png");
    expect(content(html, "og:image:type")).toBe("image/png");
    expect(content(html, "og:image:width")).toBe(String(SHARE_IMAGE.width));
    expect(content(html, "og:image:height")).toBe(String(SHARE_IMAGE.height));
    expect(content(html, "og:image:alt")).toBe(SHARE_IMAGE.alt);
  });

  it("leaves og:url out for the app shell, which answers many paths", () => {
    expect(withShareMeta(page, { origin })).not.toContain("og:url");
  });

  it("keeps replacement patterns in the content literal", () => {
    const html = withShareMeta(
      page.replace("nothing else", () => "$& $1"),
      { origin },
    );
    expect(content(html, "og:description")).toBe("Your whole year &amp; $& $1.");
  });

  it.each([
    ["<!-- @share --> marker", page.replace("<!-- @share -->", "")],
    ["<title>", page.replace(/<title>.*<\/title>/, "")],
    ['meta name="description"', page.replace(/<meta[\s\S]*?\/>/, "")],
  ])("refuses a page without a %s", (what, html) => {
    expect(() => withShareMeta(html, { origin })).toThrow(`The page has no ${what}`);
  });
});

describe("withTitle", () => {
  it("swaps the title text, escaped", () => {
    const html = withTitle(page, "Julian demo · <Year> & more");
    expect(html).toContain("<title>Julian demo · &lt;Year&gt; &amp; more</title>");
    expect(content(withShareMeta(html, { origin: "o" }), "og:title")).toBe(
      "Julian demo · &lt;Year&gt; &amp; more",
    );
  });

  it("refuses a page without a title", () => {
    expect(() => withTitle("<head></head>", "Julian")).toThrow("The page has no <title>");
  });
});
