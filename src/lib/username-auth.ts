// Convert username (no spaces, lowercase) into an internal synthetic email
// used by Supabase Auth. Users never see this email.
export const USERNAME_EMAIL_DOMAIN = "pkl.local";

export function usernameToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
}

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}