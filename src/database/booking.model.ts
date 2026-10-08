import "server-only";

import { Schema, model, models, type Model, type Types } from "mongoose";
import Event from "./event.model";

export interface IBooking {
  eventId: Types.ObjectId;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/,
    },
  },
  { timestamps: true },
);

bookingSchema.index({ eventId: 1 });

bookingSchema.pre("save", async function () {
  // Check every save and use the same session when saving in a transaction.
  const event = await Event.exists({ _id: this.eventId }).session(this.$session());

  if (!event) {
    throw new Error("Cannot save booking: the referenced event does not exist.");
  }
});

const Booking =
  (models.Booking as Model<IBooking> | undefined) ?? model<IBooking>("Booking", bookingSchema);

export default Booking;
