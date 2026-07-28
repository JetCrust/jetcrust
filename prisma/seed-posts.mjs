// Seed the Journal with two original starter guides. Idempotent: skips a post
// if its slug already exists. Run in dev or against production:
//   node prisma/seed-posts.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const posts = [
  {
    slug: "guide-to-bran-and-bran-castle",
    title: "A first-timer's guide to Bran and Bran Castle",
    excerpt:
      "Bran is more than the castle on the postcard. Here is how to see it well, where to slow down nearby, and when to come.",
    coverImage: "/assets/img/castelaria-aerial-1400.webp",
    tags: ["Bran", "Transylvania", "Guide"],
    seoTitle: "Bran and Bran Castle: A First-Timer's Guide",
    seoDescription:
      "Plan a trip to Bran in Transylvania: the castle, the village, the best season, and how to see it without the crowds.",
    body: `Bran sits where the Carpathian foothills fold into the plains, a short drive from Brasov and about three hours from Bucharest. Most people arrive for one thing, the castle, and leave before they have really seen the place. Give it a full day and it rewards you.

## The castle, seen properly

Bran Castle is a compact, steep, atmospheric warren of stairways and small rooms rather than a grand palace. Go early or late in the day and the light through the courtyard is worth the trip on its own. The rooms tell the story of Queen Marie of Romania, who made it a royal residence in the years after the First World War, alongside the folklore that draws so many visitors. Read a little before you go and the layers make more sense.

Buy tickets online when you can and start at the top, working your way down. The queues build through late morning, so an early arrival changes the whole experience.

## Beyond the walls

The village below the castle is small and easy to walk. Step past the first row of stalls and you find quiet lanes, family guesthouses, and the everyday life of a mountain community. Drive fifteen minutes into Moeciu and Fundata and the landscape opens into some of the prettiest pastoral country in Romania, all hay barns, grazing sheep, and long views to the ridgeline.

This is where a stay near Bran earns its keep. The castle is a morning; the hills are the reason to linger.

## When to come

Late spring and early autumn are the sweet spots. May and June bring green meadows and mild days. September and October turn the forests gold and thin out the crowds. Winter has its own appeal, with snow on the peaks and a fire indoors, though mountain roads ask for a little care. High summer is warm and busy, so plan the castle early and the afternoons in the hills.

## A simple plan

Give Bran a morning for the castle, an afternoon in the Moeciu hills, and an evening somewhere with a good kitchen and a view. That rhythm, one landmark and a long slow half day around it, is how the area is best enjoyed.

Our homes near Bran are built around exactly that pace. You see the famous things, then come back to somewhere calm and private that feels a world away from the ticket queue.`,
    faq: [
      { q: "How do I get to Bran?", a: "The nearest city is Brasov, about forty minutes away by car. Bucharest is roughly a three hour drive. Renting a car gives you the freedom to explore the surrounding hills, which is where much of the charm is." },
      { q: "Is Bran Castle the real Dracula's castle?", a: "There is no proven link between the historical figures behind the Dracula legend and this castle. The association is mostly literary and tourist driven. The castle's real history, as a royal residence for Queen Marie, is the more interesting story." },
      { q: "How long should I spend in Bran?", a: "A full day is ideal. Give the castle a morning and the surrounding villages of Moeciu and Fundata an afternoon. Staying overnight nearby lets you enjoy the hills once the day trippers have left." },
      { q: "When is the best time to visit?", a: "Late spring, from May to June, and early autumn, in September and October, offer the best mix of pleasant weather and thinner crowds. Winter is beautiful with snow, though roads need more care." },
      { q: "Do I need to book castle tickets in advance?", a: "It is a good idea in peak season. Booking online and arriving early helps you avoid the longest queues, which build through late morning." },
    ],
  },
  {
    slug: "a-weekend-in-bucharest",
    title: "A weekend in Bucharest: old town, museums and green escapes",
    excerpt:
      "Romania's capital rewards a slow weekend. Here is a relaxed two days across the old town, the best museums, and the parks where the city exhales.",
    coverImage: "/assets/img/soho/soho-02-800.webp",
    tags: ["Bucharest", "City", "Guide"],
    seoTitle: "A Weekend in Bucharest: What to See in Two Days",
    seoDescription:
      "A relaxed two day guide to Bucharest: the old town, the best museums, cafes, and the parks where the city slows down.",
    body: `Bucharest is a city of contrasts, where belle epoque facades sit beside bold modernist blocks, and leafy residential streets open suddenly onto grand boulevards. Two days is enough to feel its rhythm if you resist the urge to rush.

## Day one: the old town and the grand set pieces

Start in Lipscani, the old town, where the lanes are best explored on foot with no fixed plan. Coffee is taken seriously here, so let a good cafe set the morning pace. Nearby stand the landmarks that anchor the city, from the vast Palace of the Parliament to the quiet courtyards of old churches tucked between the shops.

In the afternoon, walk the wide boulevards toward Revolution Square and the Romanian Athenaeum, a concert hall whose interior is worth stepping inside for even if you are not there for a performance. This part of the city is where Bucharest earned its old nickname as a small Paris of the East.

## Day two: museums and green space

Give the morning to one or two museums rather than trying to see everything. The National Museum of Art holds a strong European and Romanian collection, and the open air Village Museum in Herastrau gathers real houses from across the country into one park, a gentle and unusual way to understand rural Romania.

Herastrau itself, and the calmer Cismigiu Gardens closer to the centre, are where the city slows down. Rent a boat, find a bench, or simply walk. Bucharest is a better city for the time you spend outdoors in it.

## Where to eat

Romanian cooking is hearty and generous, built on slow cooked meats, fresh cheeses, and good bread. Look for a place with a proper kitchen rather than a tourist menu, order a plate to share, and pair it with a Romanian wine, which is one of the country's quiet pleasures.

## A base that feels like home

A weekend like this is easier from somewhere private and central, where you can drop your bags, regroup, and step straight back out. Our Bucharest home is built for exactly that, a calm base within reach of everything above.`,
    faq: [
      { q: "Is two days enough for Bucharest?", a: "Yes, for a relaxed first visit. Two days lets you cover the old town, one or two museums, and the parks without rushing. A third day would add room for a day trip out of the city." },
      { q: "How do I get around the city?", a: "The centre is walkable, and the metro is quick and cheap for longer hops. Ride hailing apps are widely used and inexpensive for door to door trips." },
      { q: "What is the old town like?", a: "Lipscani, the old town, is a compact grid of pedestrian lanes full of cafes, restaurants, and historic churches. It is lively in the evenings and best explored on foot." },
      { q: "What should I eat in Bucharest?", a: "Look for traditional Romanian dishes such as slow cooked meats, fresh cheeses, and stews, ideally at a place with a real kitchen rather than a tourist menu. Romanian wine is well worth trying." },
      { q: "Is Bucharest a good base for exploring further?", a: "It is. Bran and the Carpathians are within a few hours by car, which makes a private base in the city a comfortable starting point for a wider trip." },
    ],
  },
];

async function main() {
  for (const p of posts) {
    const exists = await prisma.post.findUnique({ where: { slug: p.slug } });
    if (exists) {
      console.log(`skip (exists): ${p.slug}`);
      continue;
    }
    await prisma.post.create({
      data: {
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        body: p.body,
        coverImage: p.coverImage,
        tags: JSON.stringify(p.tags),
        faq: JSON.stringify(p.faq),
        seoTitle: p.seoTitle,
        seoDescription: p.seoDescription,
        status: "PUBLISHED",
        source: "manual",
        publishedAt: new Date(),
      },
    });
    console.log(`created: ${p.slug}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
