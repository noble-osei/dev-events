import "server-only";

import mongoose, { type Mongoose } from "mongoose";

type MongooseCache = {
  connection: Mongoose | null;
  promise: Promise<Mongoose> | null;
};

const globalWithMongoose = globalThis as typeof globalThis & {
  mongooseCache?: MongooseCache;
};

// Keep the connection pool across module reloads during development.
const cached = (globalWithMongoose.mongooseCache ??= {
  connection: null,
  promise: null,
});

export default async function connectToDatabase(): Promise<Mongoose> {
  if (cached.connection) {
    return cached.connection;
  }

  // Validate on first use so importing this module does not require a database.
  const uri = process.env.MONGO_URI?.trim();

  if (!uri) {
    throw new Error("Please define the MONGO_URI environment variable.");
  }

  if (!cached.promise) {
    // Concurrent requests await the same connection attempt.
    cached.promise = mongoose
      .connect(uri, {
        bufferCommands: false,
        serverSelectionTimeoutMS: 5000,
      })
      .catch((error: unknown) => {
        // Clear a failed attempt so a later request can try again.
        cached.promise = null;
        throw error;
      });
  }

  cached.connection = await cached.promise;
  return cached.connection;
}
