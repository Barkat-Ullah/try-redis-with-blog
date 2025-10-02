import { z } from 'zod';

const createSubscriptionZodSchema = z.object({
  body: z.object({
    // Example fields (customize as needed)
    name: z.string({ required_error: 'Name is required' }),
  }),
});

const updateSubscriptionZodSchema = z.object({
  body: z.object({
    name: z.string().optional(),
  }),
});

export const SubscriptionValidation = {
  createSubscriptionZodSchema,
  updateSubscriptionZodSchema,
};
