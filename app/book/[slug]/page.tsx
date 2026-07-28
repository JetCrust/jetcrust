import Link from "next/link";
import { notFound } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import BookingForm from "../../components/BookingForm";
import { auth } from "@/auth";
import { getProperty, imageUrl, type Property } from "@/lib/properties";
import { CONTRACT_TEXT } from "@/lib/contract";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; guests?: string; addons?: string; note?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const property = await getProperty(slug) as Property | null;
  if (!property || property.status !== "live") notFound();

  const session = await auth();
  const initial = {
    checkIn: sp.checkIn,
    checkOut: sp.checkOut,
    guests: sp.guests ? Number(sp.guests) : undefined,
    addons: sp.addons ? sp.addons.split(",").map((a) => a.trim()).filter(Boolean) : undefined,
    note: sp.note,
  };
  const hero = imageUrl(property.img_key, property.hero_image, 2000);

  return (
    <>
      <AppHeader />

      <section className="pdp-hero" style={{ minHeight: "48vh" }}>
        <div className="pdp-hero__media" style={{ backgroundImage: `url('${hero}')` }} />
        <div className="wrap pdp-hero__inner" style={{ paddingTop: 40 }}>
          <p className="overline eyebrow-line">{property.location}</p>
          <h1 className="pdp-hero__name">{property.name}</h1>
        </div>
      </section>

      <main className="section section--cream">
        <div className="wrap pdp-intro">
          <div className="pdp-story">
            <p className="overline eyebrow-line">Request a Booking</p>
            <h2 style={{ fontSize: "clamp(1.9rem,3.6vw,2.6rem)" }}>Check dates and reserve {property.name}</h2>
            <p className="lead" style={{ marginTop: "1rem", marginBottom: "2rem" }}>
              Choose your dates and add-ons, accept the agreement, and place a hold. We confirm personally, and your
              card is charged only once approved.
            </p>

            <BookingForm
              slug={property.slug}
              propertyName={property.name}
              minNights={property.pricing.min_nights || 1}
              maxGuests={property.capacity.sleeps}
              addons={property.addons}
              contract={CONTRACT_TEXT}
              signedIn={!!session}
              initial={initial}
            />
          </div>

          <aside className="pdp-aside">
            <div className="price">€{property.pricing.base_nightly_eur.toLocaleString("en-US")} <small>/ night</small></div>
            <div className="rule"></div>
            <ul>
              <li>Sleeps <span>Up to {property.capacity.sleeps}</span></li>
              <li>Bedrooms <span>{property.capacity.bedrooms}</span></li>
              <li>Bathrooms <span>{property.capacity.bathrooms}</span></li>
              <li>Check in <span>{property.hours.check_in}</span></li>
              <li>Check out <span>{property.hours.check_out}</span></li>
              <li>Minimum <span>{property.pricing.min_nights} nights</span></li>
            </ul>
            <p className="note">Every booking is reviewed and confirmed by our team, personally. No fees, no middlemen.</p>
          </aside>
        </div>
      </main>
    </>
  );
}
