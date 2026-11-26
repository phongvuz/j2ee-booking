import { z } from "zod";
import { tripIdSchema } from "@/lib/trip-id";

export const realtimeClientIdSchema = z.string().min(1).max(80).regex(/^[a-zA-Z0-9_-]+$/);
const realtimeSeatNumberSchema = z.string().regex(/^[ABC][0-9]{2}$/);

const seatSelectionSchema = z.object({
  seatNumber: realtimeSeatNumberSchema,
  clientId: realtimeClientIdSchema,
}).strict();

// TODO 3: schema tối thiểu theo đề, không ép chuỗi tripId thành số.
export const seatEventSchema = z.object({
  tripId: z.number().int().positive(),
  clientId: z.string().min(1),
  seatNumber: z.string().min(1),
  type: z.enum(["SEAT_SELECTED", "SEAT_DESELECTED"]),
});

// API thật bổ sung giới hạn ID, định dạng ghế/client và chặn trường lạ.
export const seatInteractionRequestSchema = seatEventSchema.extend({
  tripId: tripIdSchema,
  clientId: realtimeClientIdSchema,
  seatNumber: realtimeSeatNumberSchema,
}).strict();

export const seatSyncRequestSchema = z.object({
  tripId: tripIdSchema,
  clientId: realtimeClientIdSchema,
  selectedSeats: z.array(realtimeSeatNumberSchema).max(5).refine(
    (selectedSeats) => new Set(selectedSeats).size === selectedSeats.length,
    "Danh sách ghế không được trùng lặp.",
  ),
}).strict();

export const seatRealtimeMessageSchema = z.discriminatedUnion("type", [
  seatInteractionRequestSchema.extend({ timestamp: z.iso.datetime() }),
  z.object({
    tripId: tripIdSchema,
    type: z.literal("SEAT_SNAPSHOT"),
    selections: z.array(seatSelectionSchema),
    bookedSeats: z.array(realtimeSeatNumberSchema),
    viewerCount: z.number().int().nonnegative(),
    timestamp: z.iso.datetime(),
  }).strict(),
  z.object({
    tripId: tripIdSchema,
    type: z.literal("SEATS_CHANGED"),
    timestamp: z.iso.datetime(),
  }).strict(),
  z.object({
    tripId: tripIdSchema,
    type: z.literal("VIEWERS_UPDATED"),
    viewerCount: z.number().int().nonnegative(),
    timestamp: z.iso.datetime(),
  }).strict(),
]);

export const seatHoldEventSchema = z.object({
  type: z.enum(["SEAT_HELD", "SEAT_RELEASED"]),
  payload: z.object({
    seatNumber: realtimeSeatNumberSchema,
    clientId: z.string().min(1).max(191),
  }).strict(),
}).strict();
