"use client";

import Image from "next/image";
import posthog from "posthog-js";
import { posthogLog } from "@/lib/posthog-logger";

const ExploreBtn = () => {
  return (
    <button
      type="button"
      id="explore-btn"
      className="mt-7 mx-auto"
      onClick={() => {
        posthog.capture("events_exploration_started");
        posthogLog.eventsExplorationStarted();
      }}
    >
      <a href="#events">
        Explore Events
        <Image
          src="/icons/arrow-down.svg"
          alt="Arrow down"
          width={25}
          height={24}
          className="shrink-0"
          style={{ width: "auto", height: 24 }}
        />
      </a>
    </button>
  );
};

export default ExploreBtn;
