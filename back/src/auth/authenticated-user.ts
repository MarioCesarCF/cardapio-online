export interface AuthenticatedUser {
  id: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean | null;
  image: string | null;
  role: string | null;
}
