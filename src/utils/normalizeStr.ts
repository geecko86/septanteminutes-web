/** Converts a display string into a URL-safe slug (lowercase, hyphens, no accents). */
export default function normalizeString(str: string): string {
    return str
      .normalize('NFD') // Decompose accented characters into base + diacritic
      .replace(/[\u0300-\u036f]/g, '') // Strip the diacritic marks
      .toLowerCase()
      .replace(/\s+/g, '-') // Spaces → hyphens
      .replace(/[^\w\-]+/g, '') // Drop anything that isn't a word char or hyphen
      .replace(/\-\-+/g, '-') // Collapse consecutive hyphens
      .replace(/^-+/, '') // Trim leading hyphens
      .replace(/-+$/, ''); // Trim trailing hyphens
}
