import type { EventCategoryName, EventCategoryOption } from "./event-categories";

export type Event = {
  id: number;
  company_id: number;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  latitude?: number | null;
  longitude?: number | null;
  address: string;
  city: string;
  postal_code: string;
  category_slugs: EventCategoryName[];
  image: string;
  source?: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type EventWithCategories = Event & {
  categories: EventCategoryOption[];
};
