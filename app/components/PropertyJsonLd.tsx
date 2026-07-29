import type { Property } from "@/lib/properties";
import { areaName } from "@/lib/seo";

// Structured data (JSON-LD) for a property, so search engines understand each
// home as a vacation rental in its area, with rating stars from real reviews.
// Fully data-driven, so every new property gets it automatically.
export default function PropertyJsonLd({ p, url, image, rating, reviewCount }: {
  p: Property; url: string; image: string; rating: number; reviewCount: number;
}) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "VacationRental",
    name: p.name,
    description: p.seo?.description || p.tagline || undefined,
    url,
    image: image || undefined,
    address: { "@type": "PostalAddress", addressLocality: areaName(p.location), addressCountry: "RO" },
    priceRange: p.pricing?.base_nightly_eur ? `from €${p.pricing.base_nightly_eur}/night` : undefined,
    numberOfRooms: p.capacity?.bedrooms || undefined,
    occupancy: p.capacity?.sleeps ? { "@type": "QuantitativeValue", value: p.capacity.sleeps } : undefined,
  };
  if (reviewCount > 0) {
    data.aggregateRating = { "@type": "AggregateRating", ratingValue: rating.toFixed(1), reviewCount, bestRating: 5, worstRating: 1 };
  }
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
