import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import connectToDatabase from "@/lib/mongodb";
import Event, { type IEvent } from "@/database/event.model";

export const EVENTS_CACHE_TAG = "events";

/**
 * All events, newest first, for the home page. Cached like getEventBySlug so the list is
 * part of the prerendered page and shares the "events" tag for on-demand invalidation.
 */
export async function getEvents(): Promise<IEvent[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(EVENTS_CACHE_TAG);

  await connectToDatabase();

  // Drop _id (an ObjectId class instance) so the result is serializable for the cache.
  return Event.find()
    .select("-_id -__v")
    .sort({ createdAt: -1 })
    .lean<IEvent[]>()
    .exec();
}

/** Slugs of every event, used by generateStaticParams to prerender event pages at build time. */
export async function getEventSlugs(): Promise<string[]> {
  await connectToDatabase();

  const events = await Event.find()
    .select("slug")
    .lean<{ slug: string }[]>()
    .exec();

  return events.map((event) => event.slug);
}

/**
 * Cached so the result becomes part of the prerendered page instead of request-time data.
 * Invalidated on demand via the "events" tag, with an hourly refresh as a safety net.
 */
export async function getEventBySlug(slug: string): Promise<(IEvent & { id: string }) | null> {
  "use cache";
  cacheLife("hours");
  cacheTag(EVENTS_CACHE_TAG);

  await connectToDatabase();

  const event = await Event.findOne({ slug }).select("-__v").lean<IEvent & { _id: unknown }>().exec();

  if (!event) return null;

  // _id is an ObjectId class instance, which isn't serializable for the cache; expose it as a string id.
  const { _id, ...rest } = event;

  return { ...rest, id: String(_id) };
}

export async function getSimilarEventsBySlug(slug: string): Promise<IEvent[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(EVENTS_CACHE_TAG);

  await connectToDatabase();

  const event = await Event.findOne({ slug }).lean();
  if (!event) return [];

  return await Event.find({
    _id: { $ne: event._id },
    tags: { $in: event.tags },
  })
    .select("-_id -__v")
    .sort({ createdAt: -1 })
    .lean<IEvent[]>()
    .exec();
}
