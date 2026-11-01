import mongoose from 'mongoose';

// 1. AutoCampaign Schema
export const AutoCampaignSchema = new mongoose.Schema(
  {
    campaignName: { type: String, required: true },
    niches: [{ type: String }],
    targetCities: [{ type: String }],
    daysDuration: { type: Number, default: 7 },
    currentDay: { type: Number, default: 1 },
    dailyQuotaPerSender: { type: Number, default: 30 },
    emailPitchTemplate: { type: String },
    portfolioLinks: [
      {
        niche: { type: String },
        link: { type: String }
      }
    ],
    status: {
      type: String,
      enum: ['Active', 'Paused', 'Completed'],
      default: 'Active'
    }
  },
  { timestamps: true }
);

// 2. GlobalLeadLedger Schema
export const GlobalLeadLedgerSchema = new mongoose.Schema(
  {
    email: { type: String, unique: true, index: true, required: true, lowercase: true, trim: true },
    businessName: { type: String },
    targetNiche: { type: String, required: true, index: true },
    city: { type: String },
    website: { type: String },
    sentBySender: { type: String },
    campaignId: { type: String },
    status: {
      type: String,
      enum: ['Sent', 'Followup_1', 'Followup_2', 'Replied'],
      default: 'Sent'
    },
    lastContactedAt: { type: Date }
  },
  { timestamps: true }
);

// 3. SenderAccount Schema
export const SenderAccountSchema = new mongoose.Schema(
  {
    email: { type: String, required: true },
    smtpConfig: {
      host: { type: String },
      port: { type: Number },
      user: { type: String },
      pass: { type: String }
    },
    dailyLimit: { type: Number, default: 30 },
    sentToday: { type: Number, default: 0 },
    status: { type: String, default: 'Active' }
  },
  { timestamps: true }
);

// 4. PushSubscription Schema
export const PushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String, required: true },
    auth: { type: String, required: true }
  },
  userAgent: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Guard against duplicate model compilation in HMR / re-import environments
export const AutoCampaign =
  mongoose.models.AutoCampaign || mongoose.model('AutoCampaign', AutoCampaignSchema);

export const GlobalLeadLedger =
  mongoose.models.GlobalLeadLedger || mongoose.model('GlobalLeadLedger', GlobalLeadLedgerSchema);

export const SenderAccount =
  mongoose.models.SenderAccount || mongoose.model('SenderAccount', SenderAccountSchema);

export const PushSubscription =
  mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema);

export default {
  AutoCampaign,
  GlobalLeadLedger,
  SenderAccount,
  PushSubscription,
  AutoCampaignSchema,
  GlobalLeadLedgerSchema,
  SenderAccountSchema,
  PushSubscriptionSchema
};
