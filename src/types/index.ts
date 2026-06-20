export type VehicleStatus = 'AVAILABLE' | 'RESERVED' | 'SOLD' | 'DELIVERED' | 'HIDDEN';
export type UserRole = 'customer' | 'admin';
export type ServiceStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled';
export type DocumentType = 'Invoice' | 'Warranty' | 'MOT' | 'HPI' | 'Service' | 'Other';

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: UserRole | null;
  push_token: string | null;
  address: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface Vehicle {
  stock_id: string;
  registration: string | null;
  make: string;
  model: string;
  variant: string | null;
  year: number;
  mileage: number;
  fuel: string;
  transmission: string;
  body_type: string;
  colour: string;
  price: number;
  monthly_price: number | null;
  description: string | null;
  status: VehicleStatus;
  featured: boolean;
  created_at: string;
}

export interface CustomerVehicle {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  registration: string;
  vin: string | null;
  purchase_date: string | null;
  purchase_price: number | null;
  mileage_at_purchase: number | null;
  mot_date: string | null;
  service_date: string | null;
  warranty_start: string | null;
  warranty_expiry: string | null;
  // Finance fields (added by migration)
  deposit: number | null;
  finance_provider: string | null;
  finance_term: number | null;
  finance_monthly: number | null;
  ownership_status: string | null;
  created_at: string;
}

export interface ServiceBooking {
  id: string;
  user_id: string;
  customer_vehicle_id: string;
  service_type: string;
  preferred_date: string;
  message: string | null;
  customer_message?: string | null;
  status: ServiceStatus;
  admin_notes: string | null;
  created_at: string;
}

export interface ServiceHistory {
  id: string;
  customer_vehicle_id: string;
  service_date: string;
  mileage: number | null;
  work_done: string;
  invoice_url: string | null;
  // Extended fields (added by migration)
  service_booking_id: string | null;
  customer_id: string | null;
  service_type: string | null;
  description: string | null;
  parts_used: string | null;
  cost: number | null;
  notes: string | null;
  created_at: string;
}

export interface Document {
  id: string;
  customer_vehicle_id: string;
  user_id: string | null;
  type: string;
  title: string | null;
  description: string | null;
  file_url: string | null;
  uploaded_at: string;
  created_by: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  read: boolean;
  type: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface Warranty {
  id: string;
  customer_vehicle_id: string;
  provider: string;
  plan_name: string;
  start_date: string;
  expiry_date: string;
  coverage_details: string[];
  created_at: string;
}
