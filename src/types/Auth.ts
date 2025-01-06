export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: {
    _id: string;
    name: string;
    email: string;
  };
}
