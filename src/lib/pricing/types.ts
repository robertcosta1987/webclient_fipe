// types.ts — schemas for the pricing-function response.
//
// The pricing function forwards Molicar's payload verbatim under
// `sources[].data`. We Zod-validate every field we render so a vendor-side
// rename or null surfaces here (in the server adapter) rather than as a
// blank cell in the UI.
//
// Every field is optional on the wire — Molicar's docs say "ND" / missing
// is normal for sparse plates. The UI handles undefined gracefully.

import { z } from "zod";

const NumberLike = z.union([z.number(), z.string()]).optional().nullable().transform((v) => {
  if (v === null || v === undefined || v === "") return undefined;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
});

const StringLike = z.union([z.string(), z.number()]).optional().nullable().transform((v) => {
  if (v === null || v === undefined) return undefined;
  return String(v);
});

/** A {Min, Max, FairPrice} block — used for every KBB sale category. */
export const PriceRangeSchema = z
  .object({
    Min: NumberLike,
    Max: NumberLike,
    FairPrice: NumberLike,
  })
  .partial()
  .optional()
  .nullable();
export type PriceRange = z.infer<typeof PriceRangeSchema>;

export const DecoderSchema = z
  .object({
    Plate: StringLike,
    Vin: StringLike,
    ModelYear: NumberLike,
    Status: NumberLike,
    MolicarId: StringLike,
  })
  .partial();
export type Decoder = z.infer<typeof DecoderSchema>;

export const VehicleDataSchema = z
  .object({
    Axles: NumberLike,
    BodyType: StringLike,
    CC: NumberLike,
    Power: NumberLike,
    VehicleColor: StringLike,
    VehicleSpecie: StringLike,
    VehicleType: StringLike,
    ManufacturedYear: NumberLike,
    MaximumTractionCapacity: NumberLike,
    Nationality: StringLike,
    UFOrigin: StringLike,
    UFCurrent: StringLike,
    CurrentCityName: StringLike,
    EngineNumber: StringLike,
    Size: StringLike,
    Brand: StringLike,
    Model: StringLike,
    Version: StringLike,
    NrDoors: NumberLike,
    NrSeats: NumberLike,
    DriveTrain: StringLike,
    TotalGrossWeight: NumberLike,
    WeightCarriage: NumberLike,
    FuelType: StringLike,
    Transmission: StringLike,
    HasTurbo: z.boolean().optional().nullable(),
    ADAS: StringLike,
  })
  .partial();
export type VehicleData = z.infer<typeof VehicleDataSchema>;

export const PricingSchema = z
  .object({
    MolicarPrice: NumberLike,
  })
  .partial();
export type Pricing = z.infer<typeof PricingSchema>;

export const KBBPricingSchema = z
  .object({
    UF: StringLike,
    Grade: StringLike,
    MY: StringLike,
    Mileage: StringLike,
    Color: StringLike,
    NewVehicle: PriceRangeSchema,
    UsedDealer: PriceRangeSchema,
    SellPrivateParty: PriceRangeSchema,
    SellDealer: PriceRangeSchema,
    FPP: PriceRangeSchema,
  })
  .partial();
export type KBBPricing = z.infer<typeof KBBPricingSchema>;

/** Molicar's full payload (raw vendor JSON). */
export const MolicarPayloadSchema = z
  .object({
    Decoder: DecoderSchema.optional(),
    VehicleData: VehicleDataSchema.optional(),
    Pricing: PricingSchema.optional(),
    KBBPricing: KBBPricingSchema.optional(),
  })
  .passthrough(); // Forward-compatible: keep unknown fields around.
export type MolicarPayload = z.infer<typeof MolicarPayloadSchema>;
