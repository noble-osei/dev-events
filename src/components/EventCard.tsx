"use client";

import Link from "next/link";
import Image from "next/image";
import posthog from "posthog-js";
import { posthogLog } from "@/lib/posthog-logger";

interface Props {
  title: string;
  image: string;
  slug: string;
  location: string;
  date: string;
  time: string;
}

const EventCard = ({ title, image, slug, location, date, time }: Props) => {
  return (
    <Link
      href={`/events/${slug}`}
      id="event-card"
      onClick={() => {
        posthog.capture("event_card_selected", { event_slug: slug });
        posthogLog.eventCardSelected(slug);
      }}
    >
      <div className="relative h-75 w-full">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="poster"
        />
      </div>

      <div className="flex flex-row gap-2">
        <Image
          src="/icons/pin.svg"
          alt="location"
          width={16}
          height={18}
          className="shrink-0 self-start"
          style={{ width: 14, height: "auto" }}
        />
        <p>{location}</p>
      </div>

      <p className="title">{title}</p>

      <div className="datetime">
        <div>
          <Image
            src="/icons/calendar.svg"
            alt="date"
            width={14}
            height={14}
            className="shrink-0 self-start"
            style={{ width: 14, height: "auto" }}
          />
          <p>{date}</p>
        </div>
        <div>
          <Image
            src="/icons/clock.svg"
            alt="time"
            width={14}
            height={14}
            className="shrink-0 self-start"
            style={{ width: 14, height: "auto" }}
          />
          <p>{time}</p>
        </div>
      </div>
    </Link>
  );
};

export default EventCard;
