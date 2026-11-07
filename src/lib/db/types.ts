/* Row types mirror the Supabase schema (migrations 0001 + 0005). */

/** Everyone who registers is a member (FUJ has no "visitor" category). */
export type PersonStatus = "member" | "inactive" | "transferred" | "left_ministry";
export type StaffRole = "super_admin" | "admin" | "pastor" | "pastoral_worker" | "finance_admin" | "department_leader";

export interface Person {
  id: string;
  person_code: string | null;
  username: string | null;
  full_name: string;
  phone: string;
  normalized_phone: string;
  email: string | null;
  status: PersonStatus;
  first_visit_at: string | null;
  joined_at: string | null;
  notes: string | null;
  auth_subject: string | null;
  avatar_url: string | null;
  gender: string | null;
  birthday: string | null;
  address: string | null;
  how_heard: string | null;
  last_seen_at: string | null;
  /** Whether the phone number is reachable on WhatsApp (learned from delivery receipts). */
  whatsapp: "unknown" | "yes" | "no";
  whatsapp_checked_at: string | null;
  /** How the person signed up (everyone is verified automatically at registration). */
  verified_via: "google" | "in_person" | "admin" | "otp" | "registration" | null;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtpCode {
  id: string;
  phone: string;
  code_hash: string;
  purpose: "register";
  attempts: number;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
}

export interface Service {
  id: string;
  title: string;
  description: string | null;
  category: string;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  check_in_opens_at: string | null;
  check_in_closes_at: string | null;
  status: "scheduled" | "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export interface QrSession {
  id: string;
  service_id: string;
  status: "active" | "closed" | "revoked";
  opens_at: string;
  closes_at: string;
  created_at: string;
  closed_at: string | null;
}

export interface Attendance {
  id: string;
  person_id: string;
  service_id: string;
  checked_in_at: string;
  check_in_method: "qr" | "manual" | "admin";
  recorded_by: string | null;
  device_id: string | null;
  created_at: string;
}

export type FollowUpCategory = "absentee" | "first_timer" | "prayer" | "broadcast" | "general";
export interface FollowUpTask {
  id: string;
  person_id: string;
  reason: string;
  category: FollowUpCategory;
  priority: "low" | "normal" | "high";
  status: "open" | "in_progress" | "completed" | "dismissed";
  assignee: string | null;
  due_at: string | null;
  completed_at: string | null;
  notes: string | null;
  last_contacted_at: string | null;
  source_broadcast_id: string | null;
  /** Automatic absence follow-up messages sent for this task, and when the last one went out. */
  auto_messages_sent: number;
  last_auto_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface FollowUpLog {
  id: string;
  task_id: string;
  channel: "call" | "sms" | "whatsapp" | "visit" | "email" | "in_app" | "note";
  outcome: string;
  note: string | null;
  author: string | null;
  created_at: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  pinned: boolean;
  is_public: boolean;
  author: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrayerRequest {
  id: string;
  person_id: string | null;
  request_text: string;
  visibility: "pastoral" | "public" | "private";
  status: "pending" | "praying" | "answered" | "closed" | "approved" | "declined";
  consent_to_share: boolean;
  requester_name: string | null;
  requester_contact: string | null;
  is_anonymous: boolean;
  prayed_count: number;
  admin_note: string | null;
  assignee: string | null;
  on_wall: boolean;
  created_at: string;
  updated_at: string;
}

export interface Testimony {
  id: string;
  person_id: string | null;
  title: string;
  body: string;
  consent_to_publish: boolean;
  status: "pending" | "approved" | "declined" | "published";
  featured: boolean;
  published_at: string | null;
  reviewer: string | null;
  created_at: string;
}

export interface Donation {
  id: string;
  person_id: string | null;
  amount: number;
  currency: string;
  fund_name: string;
  status: "pending" | "paid" | "failed" | "refunded";
  provider_reference: string | null;
  paid_at: string | null;
  method: string;
  note: string | null;
  donor_name: string | null;
  recorded_by: string | null;
  created_at: string;
}

/** "whatsapp" = WhatsApp first, automatic SMS fallback for numbers not on WhatsApp. */
export type Channel = "in_app" | "whatsapp" | "sms" | "email";
export interface Broadcast {
  id: string;
  title: string;
  body: string;
  kind: "announcement" | "follow_up" | "general" | "direct";
  audience: string;
  channels: Channel[];
  status: "draft" | "sent";
  request_response: boolean;
  /** Optional flyer image (public URL). */
  image_url: string | null;
  parent_id: string | null;
  recipient_count: number;
  created_by: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface BroadcastRecipient {
  id: string;
  broadcast_id: string;
  person_id: string;
  read_at: string | null;
  response: string | null;
  responded_at: string | null;
  sms_status: string | null;
  email_status: string | null;
  whatsapp_status: string | null;
  whatsapp_message_id: string | null;
  /** Which phone channel actually carried the message: "whatsapp" | "sms" | null. */
  channel_used: string | null;
  created_at: string;
}

/** A church leader added by admins; contact details live on the linked person record. */
export interface Leader {
  id: string;
  person_id: string;
  /** The unit / ministry the person leads, e.g. "Choir" (free text, entered by admins). */
  unit: string;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: StaffRole;
  active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface ChurchSettings {
  id: boolean;
  church_name: string;
  app_name: string;
  timezone: string;
  contact_email: string | null;
  contact_phone: string | null;
  tagline: string | null;
  address: string | null;
  service_times: string | null;
  livestream_url: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  /** Consecutive missed Sundays before a member is flagged for follow-up. */
  absence_threshold: number;
  /** Automatic absence follow-up messages (see repo/auto-follow-up.ts). */
  auto_follow_up: boolean;
  follow_up_every_days: number;
  /** 0 = keep reminding until they come back. */
  follow_up_max_messages: number;
  follow_up_channels: ("whatsapp" | "sms" | "email")[];
  follow_up_first_message: string | null;
  follow_up_reminder_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface Tables {
  people: Person;
  otp_codes: OtpCode;
  services: Service;
  qr_sessions: QrSession;
  attendance: Attendance;
  follow_up_tasks: FollowUpTask;
  follow_up_logs: FollowUpLog;
  announcements: Announcement;
  prayer_requests: PrayerRequest;
  testimonies: Testimony;
  donations: Donation;
  broadcasts: Broadcast;
  broadcast_recipients: BroadcastRecipient;
  admin_users: AdminUser;
  leaders: Leader;
  church_settings: ChurchSettings;
  audit_logs: AuditLog;
}
export type TableName = keyof Tables;
