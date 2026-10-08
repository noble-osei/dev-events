import "server-only";

import { Schema, model, models, type Model } from "mongoose";

export interface IEvent {
  title: string;
  slug: string;
  description: string;
  overview: string;
  image: string;
  venue: string;
  location: string;
  date: string;
  time: string;
  mode: string;
  audience: string;
  agenda: string[];
  organizer: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

function normalizeDate(value: string): string {
  // Accept ISO dates or timestamps with an explicit timezone, avoiding local time.
  const match = /^(\d{4}-\d{2}-\d{2})(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.exec(value);

  if (!match) {
    throw new Error("Date must be an ISO date or timestamp.");
  }

  const calendarDate = new Date(`${match[1]}T00:00:00.000Z`);
  const date = new Date(value);

  // Reject impossible dates that JavaScript would otherwise roll into another month.
  if (
    Number.isNaN(calendarDate.getTime()) ||
    calendarDate.toISOString().slice(0, 10) !== match[1] ||
    Number.isNaN(date.getTime())
  ) {
    throw new Error("Date must be a valid calendar date.");
  }

  return date.toISOString().slice(0, 10);
}

function normalizeTime(value: string): string {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i.exec(value);

  if (!match) {
    throw new Error("Time must use HH:mm or h:mm AM/PM format.");
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const period = match[3]?.toUpperCase();

  if (minutes > 59 || (period ? hours < 1 || hours > 12 : hours > 23)) {
    throw new Error("Time must be a valid clock time.");
  }

  if (period) {
    hours = (hours % 12) + (period === "PM" ? 12 : 0);
  }

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

const requiredString = { type: String, required: true, trim: true };
const requiredStringArray = {
  type: [requiredString],
  required: true,
  default: undefined,
  validate: {
    validator: (values: string[]): boolean => values.length > 0,
    message: "At least one non-empty item is required.",
  },
};

const eventSchema = new Schema<IEvent>(
  {
    title: requiredString,
    // Generated in pre-save, after Mongoose's built-in required validation.
    slug: { type: String, trim: true },
    description: requiredString,
    overview: requiredString,
    image: requiredString,
    venue: requiredString,
    location: requiredString,
    date: {
      ...requiredString,
      validate: {
        validator: (value: string): boolean => Boolean(normalizeDate(value)),
        message: "Date must be a valid ISO date or timestamp.",
      },
    },
    time: {
      ...requiredString,
      validate: {
        validator: (value: string): boolean => Boolean(normalizeTime(value)),
        message: "Time must be a valid clock time.",
      },
    },
    mode: requiredString,
    audience: requiredString,
    agenda: requiredStringArray,
    organizer: requiredString,
    tags: requiredStringArray,
  },
  { timestamps: true },
);

eventSchema.index({ slug: 1 }, { unique: true });

eventSchema.pre("save", function () {
  if (this.isNew || this.isModified("title")) {
    // Fold accents and replace punctuation and whitespace with URL separators.
    this.slug = this.title
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "");
  }

  if (!this.slug?.trim()) {
    throw new Error("Event title must produce a non-empty slug.");
  }

  this.date = normalizeDate(this.date);
  this.time = normalizeTime(this.time);
});

// Reuse compiled models when Next.js reloads modules in development.
const Event = (models.Event as Model<IEvent> | undefined) ?? model<IEvent>("Event", eventSchema);

export default Event;
