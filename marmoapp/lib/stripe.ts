import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
})

export const PLANO_PRICE_MAP: Record<string, string> = {
  basic:      process.env.STRIPE_PRICE_BASIC!,
  pro:        process.env.STRIPE_PRICE_PRO!,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE!,
}

export const PRICE_PLANO_MAP: Record<string, string> = {
  [process.env.STRIPE_PRICE_BASIC!]:      'basic',
  [process.env.STRIPE_PRICE_PRO!]:        'pro',
  [process.env.STRIPE_PRICE_ENTERPRISE!]: 'enterprise',
}
