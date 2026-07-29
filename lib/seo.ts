// Location / area helpers so SEO scaffolding scales automatically as new
// properties (and areas) are added. Area is the first segment of a property's
// location string, e.g. "Bran · Transylvania" → "Bran".

export function areaName(location: string): string {
  return (location || "").split(/[·,|/]/)[0].trim() || (location || "").trim();
}

export function areaSlug(location: string): string {
  return areaName(location).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

export function postMatchesArea(tags: string[], location: string): boolean {
  const name = areaName(location).toLowerCase();
  const slug = areaSlug(location);
  if (!name) return false;
  return tags.some((t) => {
    const x = String(t).toLowerCase();
    return x === name || x.replace(/[^a-z0-9]+/g, "-") === slug || x.includes(name);
  });
}
