// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import VideoPrint from ".";

const videoId = "qNzGPn4wHnQ";
const link = `https://www.youtube.com/watch?v=${videoId}`;
const getFrame = () => screen.getByRole("img", { name: "Version vidéo de l'épisode avec Test Guest" });

afterEach(cleanup);

describe("VideoPrint", () => {
  it("lazy-loads the local frame and falls back from maxres2 WebP to JPEG", () => {
    render(
      <VideoPrint
        link={link}
        videoId={videoId}
        guestName="Test Guest"
        ready
      />
    );

    let frame = getFrame();
    expect(frame.getAttribute("loading")).toBe("lazy");
    expect(frame.getAttribute("src")).toBe(`/generated/video-frames/${videoId}.jpg`);
    expect(document.querySelector("source")?.getAttribute("srcset"))
      .toBe(`/generated/video-frames/${videoId}.webp`);
    expect(frame.getAttribute("data-loaded")).toBe("false");

    fireEvent.load(frame);
    expect(frame.getAttribute("data-loaded")).toBe("true");

    fireEvent.error(frame);
    frame = getFrame();
    expect(frame.getAttribute("src")).toBe(`https://i.ytimg.com/vi_webp/${videoId}/maxres2.webp`);
    expect(frame.getAttribute("data-loaded")).toBe("false");

    fireEvent.error(frame);
    frame = getFrame();
    expect(frame.getAttribute("src")).toBe(`https://i.ytimg.com/vi_webp/${videoId}/maxres2.webp?retry=1`);

    fireEvent.error(frame);
    frame = getFrame();
    expect(frame.getAttribute("src")).toBe(`https://i.ytimg.com/vi_webp/${videoId}/maxres2.webp?retry=2`);

    // Bounded retries prevent an unavailable upstream image from continuously
    // issuing requests for the lifetime of the page.
    fireEvent.error(frame);
    frame = getFrame();
    expect(frame.getAttribute("src")).toBe(`https://i.ytimg.com/vi/${videoId}/maxres2.jpg`);

    fireEvent.error(frame);
    frame = getFrame();
    expect(frame.getAttribute("src")).toBe(`https://i.ytimg.com/vi/${videoId}/maxres2.jpg?retry=1`);

    fireEvent.error(frame);
    frame = getFrame();
    expect(frame.getAttribute("src")).toBe(`https://i.ytimg.com/vi/${videoId}/maxres2.jpg?retry=2`);

    fireEvent.error(frame);
    expect(frame.getAttribute("src")).toBe(`https://i.ytimg.com/vi/${videoId}/maxres2.jpg?retry=2`);
  });

  it("starts a newly selected video at its canonical URL after prior retries", () => {
    const { rerender } = render(
      <VideoPrint
        link={link}
        videoId={videoId}
        guestName="Test Guest"
        ready
      />
    );

    const previousFrame = getFrame();
    fireEvent.load(previousFrame);
    expect(previousFrame.getAttribute("data-loaded")).toBe("true");
    fireEvent.error(previousFrame);
    expect(getFrame().getAttribute("src")).toBe(`https://i.ytimg.com/vi_webp/${videoId}/maxres2.webp`);

    const nextVideoId = "dQw4w9WgXcQ";
    rerender(
      <VideoPrint
        link={`https://www.youtube.com/watch?v=${nextVideoId}`}
        videoId={nextVideoId}
        guestName="Test Guest"
        ready
      />
    );

    const nextFrame = getFrame();
    expect(nextFrame).not.toBe(previousFrame);
    expect(nextFrame.getAttribute("src")).toBe(`/generated/video-frames/${nextVideoId}.jpg`);
    expect(nextFrame.getAttribute("data-loaded")).toBe("false");

    // The previous element is no longer connected, so its late failure cannot
    // alter the newly mounted frame's retry state.
    fireEvent.error(previousFrame);
    expect(nextFrame.getAttribute("src")).toBe(`/generated/video-frames/${nextVideoId}.jpg`);
  });
});
