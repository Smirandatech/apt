export interface User {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "developer" | "bidder" | "manager";
  created_at?: string;
}
