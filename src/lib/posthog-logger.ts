"use client";

import posthog from "posthog-js";

export const posthogLog = {
  eventsExplorationStarted() {
    posthog.logger.info("events exploration started", {
      action: "events_exploration_started",
      surface: "explore_button",
    });
  },
  eventCardSelected(eventSlug: string) {
    posthog.logger.info("event card selected", {
      action: "event_card_selected",
      event_slug: eventSlug,
      surface: "event_card",
    });
  },
};
