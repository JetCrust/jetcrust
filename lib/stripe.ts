import Stripe from "stripe";

// Use the fetch-based HTTP client: it's the reliable choice on Vercel's
// serverless runtime (the default Node client can hit connection errors),
// with a few network retries and a sane timeout.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  httpClient: Stripe.createFetchHttpClient(),
  maxNetworkRetries: 3,
  timeout: 20000,
});
