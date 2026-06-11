import type { EventCategoryName, EventCategoryOption } from "./event-categories";

export type Event = {
  id: number;
  organization_id: number;
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
  price: number;
  ticketing_link: string;
  source?: string | null;
  is_active: boolean;
  suspended_until?: string | null;
  suspension_reason?: string | null;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
};

export type EventWithCategories = Event & {
  categories: EventCategoryOption[];
};
