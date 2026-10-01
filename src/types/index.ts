export type LeadStatus = 'new' | 'contacted' | 'opened' | 'replied' | 'bounced' | 'converted' | 'unsubscribed';

export interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  instagram?: string;
  github?: string;
  facebook?: string;
  tiktok?: string;
  youtube?: string;
  reddit?: string;
  threads?: string;
  pinterest?: string;
  crunchbase?: string;
  [key: string]: string | undefined;
}

export interface LeadTag {
  id: string;
  name: string;
  color: 'blue' | 'cyan' | 'emerald' | 'purple' | 'amber' | 'rose' | 'indigo' | 'pink' | 'orange';
  description?: string;
  createdAt: string;
}

export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  niche: string;
  location: string;
  source: string;
  companySize: string;
  leadScore: number; // 0 - 100
  icebreaker: string;
  socials: SocialLinks;
  status: LeadStatus;
  websiteStatus: 'alive' | 'checking' | 'dead';
  responseTimeMs?: number;
  lastActivityDate: string;
  daysAgo: number; // e.g., 2, 7, 14, 30, 45
  sentCampaigns: string[];
  customNotes?: string;
  tags: string[]; // Tag names or IDs
  openCount?: number;
  lastOpenedAt?: string;
  isReplied?: boolean;
  lastRepliedAt?: string;
  replySnippet?: string;
  isTrash: boolean;
  deletedAt?: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  driveFolderUrl?: string;
  driveFileUrl?: string;
  viewUrl?: string;
  downloadUrl?: string;
  uploadedToDrive?: boolean;
  source?: 'incoming' | 'outgoing' | 'drive_hub';
  uploadedAt?: string;
  storageProvider?: 'google_drive' | 'memory';
  contentBase64?: string;
}

export interface GoogleDriveStorageSettings {
  folderUrl: string;
  folderId: string;
  folderName: string;
  appsScriptWebAppUrl?: string;
  autoIncludeDriveLinkInEmail?: boolean;
  autoAttachDriveLinkInEmail?: boolean;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  sender: 'user' | 'lead';
  senderName: string;
  senderEmail: string;
  recipientName: string;
  recipientEmail: string;
  smtpAccountId?: string;
  timestamp: string;
  subject: string;
  body: string; // Clean body without '>' prefixes
  signatureHtml?: string;
  attachments?: EmailAttachment[];
  isRead: boolean;
  status: 'sent' | 'delivered' | 'opened' | 'replied';
}

export interface EmailThread {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string;
  leadEmail: string;
  leadAvatar?: string;
  smtpAccountId?: string;
  smtpEmail?: string;
  subject: string;
  lastMessage: string;
  lastMessageDate: string;
  updatedAt?: string;
  unreadCount: number;
  labels: string[]; // e.g. "Hot Lead", "Follow Up Needed", "Negotiation", "VIP"
  isStarred: boolean;
  isTrash: boolean;
  deletedAt?: string;
  messages: EmailMessage[];
}

export interface CampaignStep {
  stepNumber: number;
  delayDays: number;
  subject: string;
  body: string;
  triggerCondition: 'all' | 'opened_no_reply' | 'not_opened_7d' | 'not_opened_14d' | 'not_opened_30d' | 'no_reply_7d' | 'no_reply_14d' | 'no_reply_30d';
}

export interface Campaign {
  id: string;
  name: string;
  niche: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  totalLeads: number;
  sentCount: number;
  openCount: number;
  replyCount: number;
  bounceCount: number;
  leadIds: string[];
  steps: CampaignStep[];
  sendMode?: 'instant' | 'scheduled';
  scheduledTime?: string;
  sendingIntervalSec?: number;
  assignedSmtpId?: string;
  assignedSmtpIds?: string[];
  senderName?: string;
  senderEmail?: string;
  scheduleActiveDays?: string[]; // e.g. ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
  scheduleStartTime?: string; // "09:00"
  scheduleEndTime?: string; // "18:00"
  scheduleTimezone?: string; // "Asia/Dhaka", "America/New_York", "UTC"
  jitterRandom?: boolean;
  selectedTemplateId?: string;
  createdAt: string;
  lastRunAt?: string;
  isTrash?: boolean;
  deletedAt?: string;
}

export interface SMTPScheduleSettings {
  sendMode: 'instant' | 'scheduled';
  intervalSeconds: number; // e.g. 5, 10, 30, 45, 60
  jitterRandom: boolean; // add random variation to mimic human sending
  scheduleStartTime?: string; // "09:00"
  scheduleEndTime?: string; // "18:00"
  timezone: string; // "America/New_York", "Asia/Dhaka", "UTC"
  activeDays: string[]; // ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
}

export interface SMTPAccount {
  id: string;
  name: string;
  provider: 'resend' | 'brevo' | 'domain_webmail' | 'gmail' | 'outlook' | 'ses' | 'sendgrid' | 'mailgun' | 'zoho' | 'hostinger' | 'custom';
  host: string;
  port: number;
  encryption: 'STARTTLS' | 'SSL' | 'TLS' | 'NONE';
  username: string;
  fromName: string;
  fromEmail?: string;
  apiKey?: string;
  domainWebmailUrl?: string; // e.g., https://webmail.yourdomain.com
  dailyLimit: number;
  sentToday: number;
  warmupStatus: 'active' | 'warming' | 'paused';
  warmupMode?: 'ramp_15' | 'full' | 'paused';
  warmupStartDate?: string;
  warmupCurrentDay?: number;
  warmupCurrentLimit?: number;
  assignedCampaigns?: string[]; // Names of campaigns running on this SMTP
  healthScore: number; // 0 - 100
  deliverabilityScore?: number;
  isConnected: boolean;
  isTrash: boolean;
  deletedAt?: string;
  scheduleSettings?: SMTPScheduleSettings;
  password?: string;
  replyToEmail?: string;
  authMethod?: 'LOGIN' | 'PLAIN' | 'XOAUTH2' | 'CRAM-MD5';
  customHeaders?: Record<string, string>;
  notes?: string;
}

export interface NotificationSettings {
  soundEnabled: boolean;
  soundPreset: 'chime' | 'bell' | 'ping' | 'crisp' | 'radar' | 'custom';
  customAudioBase64: string | null;
  volume: number; // 0 - 100
  desktopPushEnabled: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'reply' | 'open' | 'bounce' | 'lead' | 'campaign' | 'smtp' | 'system';
  timestamp: string;
  isRead: boolean;
  linkTab?: string;
  leadEmail?: string;
  threadId?: string;
  senderName?: string;
  senderCompany?: string;
  subject?: string;
}

export interface CustomerPermissions {
  leadMinerEnabled: boolean;
  smartInboxEnabled: boolean;
  campaignAutomationEnabled: boolean;
  smtpRotationEnabled: boolean;
  aiCopilotEnabled: boolean;
  templatesEnabled: boolean;
  analyticsEnabled: boolean;
  maxSmtpSlots: number;
  dailySendLimit: number;
  accountStatus: 'active' | 'suspended' | 'pending';
}

export interface ClientPaymentInfo {
  method: 'bKash';
  planId?: string;
  planCode?: 'Free' | 'Pro' | 'Agency' | 'Enterprise';
  planName: string;
  amountBDT: number;
  trxId: string;
  senderPhone: string;
  paymentDate: string;
  status: 'paid' | 'verified' | 'pending' | 'rejected';
  ownerPayoutAccount: string;
  quotaLimit?: number;
  aiCredits?: number;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: 'client' | 'agency' | 'owner' | 'manager' | 'rep' | 'customer';
  isOwner?: boolean;
  plan: 'Free' | 'Pro' | 'Agency' | 'Enterprise';
  bdtPlanLabel?: string;
  quotaUsed: number;
  quotaLimit: number;
  aiCredits: number;
  company?: string;
  title?: string;
  phone?: string;
  paymentInfo?: ClientPaymentInfo;
  permissions?: CustomerPermissions;
  joinedAt?: string;
  lastLoginAt?: string;
  authProvider?: 'google' | 'email';
  password?: string;
  supabaseId?: string;
}

export interface TemplateCategory {
  id: string;
  name: string;
  label: string;
  color: string;
  isCustom?: boolean;
}

export interface EmailTemplate {
  id: string;
  title: string;
  category: string; // Category ID or name
  subject: string;
  body: string;
  tags: string[];
  isCustom?: boolean;
  usageCount: number;
  replyRatePercent: number;
  createdAt: string;
  isTrash?: boolean;
  deletedAt?: string;
}

export interface ColumnSetting {
  id: string;
  label: string;
  visible: boolean;
}

export interface DirectSendMailPayload {
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  senderSmtpId: string;
  sendMode?: 'instant' | 'scheduled';
  scheduledTime?: string;
  sendIntervalSeconds?: number;
  signatureHtml?: string;
  attachments?: EmailAttachment[];
}

export interface SentEmailLog {
  id: string;
  campaignId?: string;
  campaignName: string;
  recipientName: string;
  recipientEmail: string;
  recipientCompany: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
  smtpAccountId?: string;
  senderEmail?: string;
  smtpAccountName: string;
  smtpHost: string;
  sentAt: string;
  status: 'sent' | 'opened' | 'replied' | 'failed' | 'bounced';
  errorMessage?: string;
  openCount: number;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  repliedAt?: string;
  ipAddress?: string;
  userAgent?: string;
  trackingPixelId?: string;
  isTrash?: boolean;
  deletedAt?: string;
}

export interface SimulatedReplyPayload {
  leadId?: string;
  leadName?: string;
  leadEmail?: string;
  company?: string;
  customText?: string;
  sentiment?: 'interested' | 'demo' | 'question' | 'not_interested';
  subject?: string;
  delaySeconds?: number;
}
