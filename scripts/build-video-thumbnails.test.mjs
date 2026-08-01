import { describe, expect, it } from "vitest";

import { pickMedoid, storyboardLevelFromHtml } from "./build-video-thumbnails.mjs";

describe("storyboardLevelFromHtml", () => {
  it("selects the highest level and M13 without corrupting the signed query", () => {
    const spec = "https://i.ytimg.com/sb/video/storyboard3_L$L/$N.jpg?sqp=signed|160#90#200#5#5#10000#M$M#rs$Lower|320#180#200#3#3#10000#M$M#rs$AHash";
    const escaped = JSON.stringify(spec).slice(1, -1);
    const level = storyboardLevelFromHtml(`{"playerStoryboardSpecRenderer":{"spec":"${escaped}"}}`);

    expect(level).toEqual({
      width: 320,
      height: 180,
      columns: 3,
      rows: 3,
      url: "https://i.ytimg.com/sb/video/storyboard3_L1/M13.jpg?sqp=signed&sigh=rs$AHash",
    });
  });

  it("rejects videos that do not reach sheet M13", () => {
    const spec = "https://i.ytimg.com/sb/video/storyboard3_L$L/$N.jpg?sqp=signed|320#180#100#3#3#10000#M$M#rs$AHash";
    expect(() => storyboardLevelFromHtml(`{"playerStoryboardSpecRenderer":{"spec":"${spec}"}}`))
      .toThrow("too short");
  });
});

describe("pickMedoid", () => {
  it("selects a representative of the recurring camera view", () => {
    const guest = [
      Buffer.from([10, 10]),
      Buffer.from([11, 9]),
      Buffer.from([9, 11]),
      Buffer.from([12, 10]),
      Buffer.from([10, 12]),
    ];
    const host = [
      Buffer.from([220, 220]),
      Buffer.from([221, 219]),
      Buffer.from([219, 221]),
      Buffer.from([222, 220]),
    ];

    expect(pickMedoid([...guest, ...host])).toBeLessThan(guest.length);
  });
});
