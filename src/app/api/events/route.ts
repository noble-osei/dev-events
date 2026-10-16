import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import connectToDatabase from "@/lib/mongodb";
import { EVENTS_CACHE_TAG } from "@/lib/events";
import Event from "@/database/event.model";

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();

    const formData = await req.formData();

    let event;

    try {
      event = Object.fromEntries(formData.entries());
    } catch (error) {
      console.log(error);
      return NextResponse.json({ message: "Invalid JSON data format"}, { status: 400 });
    }

    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ message: "Image file is required" }, { status: 400 });
    }

    const tags = JSON.parse(formData.get("tags") as string);
    const agenda = JSON.parse(formData.get("agenda") as string);

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({ resource_type: "image", folder: "DevEvent" }, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }).end(buffer);
    });

    event.image = (uploadResult as { secure_url: string }).secure_url;

    const createdEvent = await Event.create({
      ...event,
      tags,
      agenda,
    });

    // Mark cached event data stale so new events show up without waiting for the hourly refresh.
    revalidateTag(EVENTS_CACHE_TAG, "max");

    return NextResponse.json({ message: "Event Created Successfully", event: createdEvent }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      message: "Event Creation Failed",
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    await connectToDatabase();

    const events = await Event.find().sort({ createdAt: -1 });

    return NextResponse.json({message: "Events fetched successfully", events }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Event fetching failed", error: error }, { status: 500 });
  }
}