import { NextRequest, NextResponse } from "next/server";
import connectToDatabase from "@/lib/mongodb";
import Event, { type IEvent } from "@/database/event.model";

type RouteParams = { params: Promise<{ slug: string }> };

type ErrorBody = { message: string };

const MAX_SLUG_LENGTH = 200;

// Matches slugs produced by the Event model: unicode letters/digits joined by single hyphens.
const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

function errorResponse(
  message: string,
  status: number,
): NextResponse<ErrorBody> {
  return NextResponse.json({ message }, { status });
}

/** Normalizes the raw route param, returning null when it is not a valid slug. */
function parseSlug(raw: string | undefined): string | null {
  const slug = raw?.trim().toLowerCase();

  if (!slug || slug.length > MAX_SLUG_LENGTH || !SLUG_PATTERN.test(slug)) {
    return null;
  }

  return slug;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { slug: rawSlug } = await params;

    if (!rawSlug?.trim()) {
      return errorResponse("Event slug is required.", 400);
    }

    const slug = parseSlug(rawSlug);

    if (!slug) {
      return errorResponse(
        "Invalid event slug. Use letters, numbers, and single hyphens only.",
        400,
      );
    }

    await connectToDatabase();

    // lean() returns a plain object, skipping Mongoose document overhead for a read-only response.
    const event = await Event.findOne({ slug }).lean<IEvent>().exec();

    if (!event) {
      return errorResponse(`Event with slug "${slug}" was not found.`, 404);
    }

    return NextResponse.json(
      { message: "Event fetched successfully", event },
      { status: 200 },
    );
  } catch (error: unknown) {
    // Log details server-side only; never leak internal errors to the client.
    console.error("GET /api/events/[slug] failed:", error);
    return errorResponse(
      "An unexpected error occurred while fetching the event.",
      500,
    );
  }
}
