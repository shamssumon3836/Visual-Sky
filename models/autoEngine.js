import { createRequire } from 'module';

const safeRequire = (mod) => {
  try {
    if (typeof require === 'function') return require(mod);
  } catch {}
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      return createRequire(import.meta.url)(mod);
    }
  } catch {}
  return null;
};

const mongoose = safeRequire('mongoose');

// 1. AutoCampaign Schema
export const AutoCampaignSchema = mongoose
  ? new mongoose.Schema(
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
    )
  : null;

// 2. GlobalLeadLedger Schema
export const GlobalLeadLedgerSchema = mongoose
  ? new mongoose.Schema(
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
    )
  : null;

// 3. SenderAccount Schema
export const SenderAccountSchema = mongoose
  ? new mongoose.Schema(
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
    )
  : null;

// 4. PushSubscription Schema
export const PushSubscriptionSchema = mongoose
  ? new mongoose.Schema({
      endpoint: { type: String, required: true, unique: true },
      keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
      },
      userAgent: { type: String },
      createdAt: { type: Date, default: Date.now }
    })
  : null;

// Guard against duplicate model compilation in HMR / re-import environments
export const AutoCampaign = mongoose
  ? mongoose.models.AutoCampaign || mongoose.model('AutoCampaign', AutoCampaignSchema)
  : null;

export const GlobalLeadLedger = mongoose
  ? mongoose.models.GlobalLeadLedger || mongoose.model('GlobalLeadLedger', GlobalLeadLedgerSchema)
  : null;

export const SenderAccount = mongoose
  ? mongoose.models.SenderAccount || mongoose.model('SenderAccount', SenderAccountSchema)
  : null;

export const PushSubscription = mongoose
  ? mongoose.models.PushSubscription || mongoose.model('PushSubscription', PushSubscriptionSchema)
  : null;

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
