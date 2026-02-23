export interface Document {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: Date | string;
  updated_at: Date | string;
  publication_status: "unpublished" | "hidden" | "live";
}
