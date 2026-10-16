"use server";

import { revalidatePath } from "next/cache";
import connectToDatabase from "@/lib/mongodb";
import Booking from "@/database/booking.model";

export const createBooking = async ({
  eventId,
  slug,
  email,
}: {
  eventId: string;
  slug: string;
  email: string;
}) => {
  try {
    await connectToDatabase();
    await Booking.create({ eventId, email })

    revalidatePath(`/events/${slug}`);

    return { success: true };
  } catch (error) {
    console.error("Create booking failed", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};
