/**
 * Helpers for splitting a podcast episode title into its two parts.
 *
 * Episode titles follow the pattern: "Guest Name - Episode Topic"
 * where the separator is either a hyphen (-) or an en-dash (–), with
 * optional surrounding spaces. The split produces an array like:
 *   [0] guest name, [1] separator, [2] topic
 * so we grab index 0 for the guest and index 2 for the topic.
 */

/** Returns the guest name portion of a title (everything before the dash). */
export function getGuestName(title: string | undefined): string {
  return title?.split(/\s(-|–)\s?/g)[0]?.trim() ?? '';
}

/** Returns the topic portion of a title (everything after the dash). */
export function getEpisodeTopic(title: string | undefined): string {
  return title?.split(/\s(-|–)\s?/g)[2]?.trim() ?? '';
}
