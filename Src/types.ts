export interface User {
  id: number;
  username: string;
  role: 'admin' | 'control' | 'driver' | 'supervisor' | 'technician';
  status?: 'available' | 'busy';
}

export interface Vehicle {
  id: number;
  registration: string;
}

export interface Alarm {
  id: number;
  client_name: string;
  address: string;
  status: 'pending' | 'dispatched' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_driver_id: number;
  lat?: number;
  lng?: number;
  driver_name?: string;
  alarm_type?: string;
  incident_details?: string;
  created_at: string;
}

export interface Feedback {
  id: number;
  alarm_id: number;
  driver_id: number;
  vehicle_id: number;
  client_name: string;
  address: string;
  feedback_text: string;
  image_analysis?: string;
  driver_name?: string;
  vehicle_registration?: string;
  created_at: string;
}
