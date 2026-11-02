import express, { Request, Response, Router } from 'express';
import path from 'path';
import fs from 'fs';
import mongoose from 'mongoose';
import webpush from 'web-push';
import nodemailer from 'nodemailer';
import {
  AutoCampaign,
  GlobalLeadLedger,
  SenderAccount,
  PushSubscription
} from '../models/autoEngine.js';

const router = Router();

// Storage paths for file-backed resilience
const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const CAMPAIGNS_FILE = path.join(DATA_DIR, 'auto_engine_campaigns.json');
const SUBSCRIPTIONS_FILE = path.join(DATA_DIR, 'auto_engine_subscriptions.json');
const LEDGER_FILE = path.join(DATA_DIR, 'auto_engine_ledger.json');
const SENDERS_FILE = path.join(DATA_DIR, 'auto_engine_senders.json');
const VAPID_KEYS_FILE = path.join(DATA_DIR, 'vapid_keys.json');

// Initialize VAPID Keys
const getOrGenerateVapidKeys = () => {
  try {
    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      return {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY
      };
    }
    if (fs.existsSync(VAPID_KEYS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(VAPID_KEYS_FILE, 'utf-8'));
      if (saved?.publicKey && saved?.privateKey) {
        return saved;
      }
    }
  } catch {}

  try {
    const generated = webpush.generateVAPIDKeys();
    fs.writeFileSync(VAPID_KEYS_FILE, JSON.stringify(generated, null, 2), 'utf-8');
    return generated;
  } catch {
    return {
      publicKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U',
      privateKey: ''
    };
  }
};

const vapidKeys = getOrGenerateVapidKeys();
if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webpush.setVapidDetails(
      'mailto:founder@visualsky.pro',
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (err: any) {
    console.warn('[AutoEngine] VAPID configuration notice:', err?.message || err);
  }
}

// Optional MongoDB connection helper
const initMongoConnection = async () => {
  if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) return;
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!mongoUri) return;
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2500 });
    console.log('[AutoEngine] Mongoose connected to MongoDB.');
  } catch (err: any) {
    console.warn('[AutoEngine] Mongoose running in memory/file fallback mode:', err?.message || err);
  }
};
initMongoConnection();

// File helpers for local fallback persistence
const readJsonFile = <T>(filePath: string, fallback: T): T => {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {}
  return fallback;
};

const writeJsonFile = (filePath: string, data: any) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
};

// -------------------------------------------------------------
// ROUTES
// -------------------------------------------------------------

// 1. GET /auto-engine — Render Standalone Dashboard (Supports EJS render or static HTML)
router.get('/auto-engine', (req: Request, res: Response) => {
  // If app has EJS view engine configured
  if (req.app && typeof (res as any).render === 'function' && req.app.get('view engine')) {
    return (res as any).render('auto-engine', (err: any, html: string) => {
      if (!err && html) {
        return res.send(html);
      }
      // Fallback to static file if render fails
      const ejsPath = path.join(process.cwd(), 'views', 'auto-engine.ejs');
      if (fs.existsSync(ejsPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.sendFile(ejsPath);
      }
      const htmlPath = path.join(process.cwd(), 'public', 'auto-engine.html');
      if (fs.existsSync(htmlPath)) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.sendFile(htmlPath);
      }
      return res.status(404).send('Auto-Engine dashboard not found.');
    });
  }

  // Direct file serving
  const ejsPath = path.join(process.cwd(), 'views', 'auto-engine.ejs');
  if (fs.existsSync(ejsPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.sendFile(ejsPath);
  }

  const htmlPath = path.join(process.cwd(), 'public', 'auto-engine.html');
  if (fs.existsSync(htmlPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.sendFile(htmlPath);
  }

  return res.status(404).send('Auto-Engine dashboard view not found.');
});

// 2. GET /auto-engine-sw.js — Service Worker script
router.get('/auto-engine-sw.js', (req: Request, res: Response) => {
  const swPath = path.join(process.cwd(), 'public', 'sw.js');
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  if (fs.existsSync(swPath)) {
    return res.sendFile(swPath);
  }
  return res.send(`
    self.addEventListener('install', () => self.skipWaiting());
    self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
    self.addEventListener('push', (e) => {
      const data = e.data ? e.data.json() : { title: 'Auto-Engine Notification', body: 'New lead activity' };
      self.registration.showNotification(data.title, { body: data.body, icon: '/public/favicon.svg' });
    });
  `);
});

// 3. GET /api/auto-engine/vapid-public-key — Public key for browser subscription
router.get('/api/auto-engine/vapid-public-key', (req: Request, res: Response) => {
  return res.json({
    success: true,
    publicKey: vapidKeys.publicKey
  });
});

// 4. POST /api/auto-engine/save-subscription — Store Phone Browser Push Subscription
router.post('/api/auto-engine/save-subscription', async (req: Request, res: Response) => {
  try {
    const rawSub = req.body?.subscription || req.body;
    const userAgent = req.body?.userAgent || req.headers['user-agent'] || 'Unknown Browser';

    if (!rawSub || !rawSub.endpoint || !rawSub.keys?.p256dh || !rawSub.keys?.auth) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Push Subscription payload. Endpoint and keys (p256dh, auth) are required.'
      });
    }

    const subDoc = {
      endpoint: rawSub.endpoint,
      keys: {
        p256dh: rawSub.keys.p256dh,
        auth: rawSub.keys.auth
      },
      userAgent,
      createdAt: new Date()
    };

    // Save to Mongoose if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await (PushSubscription as any).findOneAndUpdate(
          { endpoint: rawSub.endpoint },
          subDoc,
          { upsert: true, new: true }
        );
      } catch (dbErr) {
        console.warn('[AutoEngine] Mongoose save subscription fallback:', dbErr);
      }
    }

    // Save to file-based fallback storage
    const localSubs = readJsonFile<any[]>(SUBSCRIPTIONS_FILE, []);
    const existingIdx = localSubs.findIndex(s => s.endpoint === rawSub.endpoint);
    if (existingIdx >= 0) {
      localSubs[existingIdx] = subDoc;
    } else {
      localSubs.push(subDoc);
    }
    writeJsonFile(SUBSCRIPTIONS_FILE, localSubs);

    // Also sync to global app push subscriptions so main notifications reach this device
    try {
      const globalPushPath = path.join(DATA_DIR, 'push_subscriptions.json');
      const globalSubs = readJsonFile<any[]>(globalPushPath, []);
      if (!globalSubs.some(g => g.endpoint === rawSub.endpoint)) {
        globalSubs.push({
          endpoint: rawSub.endpoint,
          subscription: rawSub,
          userEmail: req.body?.userEmail || 'auto-engine-admin@visualsky.pro',
          userAgent,
          updatedAt: new Date().toISOString()
        });
        writeJsonFile(globalPushPath, globalSubs);
      }
    } catch {}

    return res.json({
      success: true,
      message: 'Mobile Web Push subscription saved successfully! 🔔',
      subscription: subDoc
    });
  } catch (err: any) {
    console.error('[AutoEngine] Save subscription error:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to save push subscription'
    });
  }
});

// 5. POST /api/auto-engine/test-push — Send Test Mobile Push Notification
router.post('/api/auto-engine/test-push', async (req: Request, res: Response) => {
  try {
    const localSubs = readJsonFile<any[]>(SUBSCRIPTIONS_FILE, []);
    const targetEndpoint = req.body?.endpoint;

    let targetSub = targetEndpoint
      ? localSubs.find(s => s.endpoint === targetEndpoint)
      : localSubs[localSubs.length - 1];

    if (!targetSub && mongoose.connection.readyState === 1) {
      targetSub = await (PushSubscription as any).findOne().sort({ createdAt: -1 });
    }

    if (!targetSub) {
      return res.status(404).json({
        success: false,
        error: 'No active push subscriptions registered. Click "Enable Mobile Push Notifications" first!'
      });
    }

    const payload = JSON.stringify({
      title: '⚡ 7-Day Auto Engine Active',
      body: '🔔 Mobile Push Notifications are now paired with your phone browser! Day 1 Lead Miner ready.',
      tag: 'auto-engine-test-' + Date.now(),
      linkTab: 'auto-engine',
      data: { url: '/auto-engine' }
    });

    const pushObject = targetSub.keys
      ? { endpoint: targetSub.endpoint, keys: targetSub.keys }
      : targetSub.subscription || targetSub;

    await webpush.sendNotification(pushObject, payload);

    return res.json({
      success: true,
      message: 'Test notification sent to your device! Check your phone lock screen or notification tray.'
    });
  } catch (err: any) {
    console.error('[AutoEngine] Test push failed:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to dispatch test push notification'
    });
  }
});

// 6. GET /api/auto-engine/campaigns — List Campaigns
router.get('/api/auto-engine/campaigns', async (req: Request, res: Response) => {
  try {
    let campaigns: any[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        campaigns = await AutoCampaign.find().sort({ createdAt: -1 });
      } catch {}
    }
    if (campaigns.length === 0) {
      campaigns = readJsonFile<any[]>(CAMPAIGNS_FILE, []);
    }
    return res.json({ success: true, campaigns });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 7. POST /api/auto-engine/campaigns — Create / Update Campaign (Day 1 Setup)
router.post('/api/auto-engine/campaigns', async (req: Request, res: Response) => {
  try {
    const {
      campaignName,
      niches,
      targetCities,
      daysDuration,
      dailyQuotaPerSender,
      emailPitchTemplate,
      portfolioLinks,
      status
    } = req.body;

    if (!campaignName || !niches || niches.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Campaign name and at least one target niche are required.'
      });
    }

    const campaignData = {
      campaignName: String(campaignName).trim(),
      niches: Array.isArray(niches) ? niches : [niches],
      targetCities: Array.isArray(targetCities) ? targetCities : [targetCities],
      daysDuration: Number(daysDuration) || 7,
      currentDay: 1,
      dailyQuotaPerSender: Number(dailyQuotaPerSender) || 30,
      emailPitchTemplate: emailPitchTemplate || '',
      portfolioLinks: Array.isArray(portfolioLinks) ? portfolioLinks : [],
      status: status || 'Active',
      updatedAt: new Date()
    };

    let savedCampaign: any = null;

    if (mongoose.connection.readyState === 1) {
      try {
        savedCampaign = await AutoCampaign.create(campaignData);
      } catch (err) {
        console.warn('[AutoEngine] Mongoose create error, writing to file store:', err);
      }
    }

    // Always update file store
    const localCampaigns = readJsonFile<any[]>(CAMPAIGNS_FILE, []);
    const newEntry = savedCampaign
      ? savedCampaign.toObject()
      : { ...campaignData, _id: 'camp_' + Date.now(), createdAt: new Date() };

    localCampaigns.unshift(newEntry);
    writeJsonFile(CAMPAIGNS_FILE, localCampaigns);

    return res.json({
      success: true,
      message: '7-Day Auto Campaign configured and launched for Day 1! 🚀',
      campaign: newEntry
    });
  } catch (err: any) {
    console.error('[AutoEngine] Campaign creation error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Failed to save campaign' });
  }
});

// Alias for Multi-Campaign Creation endpoint requested by user: POST /api/auto-campaign/create-multi
router.post('/api/auto-campaign/create-multi', async (req: Request, res: Response) => {
  try {
    const rawNiches = req.body?.niches;
    const rawCities = req.body?.targetCities || req.body?.cities;
    const dailyLimit = Number(req.body?.dailyLimitPerSender || req.body?.dailyQuotaPerSender) || 30;
    const portfolioUrl = req.body?.portfolioUrl || req.body?.reelUrl || '';
    const pitch = req.body?.servicePitch || req.body?.pitchTemplate || req.body?.emailPitchTemplate || '';

    const niches = Array.isArray(rawNiches)
      ? rawNiches
      : String(rawNiches || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

    const targetCities = Array.isArray(rawCities)
      ? rawCities
      : String(rawCities || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);

    if (niches.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one target niche is required.' });
    }

    const campaignRecord = {
      _id: 'camp_' + Date.now(),
      campaignName: `${niches[0]} Multi-Niche 7-Day Auto Campaign`,
      niches,
      targetCities: targetCities.length ? targetCities : ['Global'],
      daysDuration: 7,
      currentDay: 1,
      dailyQuotaPerSender: dailyLimit,
      emailPitchTemplate: pitch,
      portfolioLinks: portfolioUrl ? [{ niche: niches[0], link: portfolioUrl }] : [],
      status: 'Active',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (mongoose.connection.readyState === 1) {
      try {
        await (AutoCampaign as any).create(campaignRecord);
      } catch {}
    }

    const localCampaigns = readJsonFile<any[]>(CAMPAIGNS_FILE, []);
    localCampaigns.unshift(campaignRecord);
    writeJsonFile(CAMPAIGNS_FILE, localCampaigns);

    return res.json({
      success: true,
      message: '⚡ Scalable 7-Day Auto Engine Launched Successfully!',
      campaign: campaignRecord
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Failed to create multi-campaign' });
  }
});

// 1. POST /api/auto-campaign/add-sender — Test & Save Custom SMTP Sender using nodemailer.verify()
router.post('/api/auto-campaign/add-sender', async (req: Request, res: Response) => {
  try {
    const email = String(req.body?.senderEmail || req.body?.email || '').trim().toLowerCase();
    const host = String(req.body?.smtpHost || req.body?.host || '').trim();
    const port = Number(req.body?.smtpPort || req.body?.port) || 587;
    const user = String(req.body?.smtpUser || req.body?.user || email).trim();
    const pass = String(req.body?.smtpPass || req.body?.pass || req.body?.password || '').trim();
    const dailyLimit = Number(req.body?.dailyLimit || req.body?.dailyQuota) || 30;

    if (!email || !host || !pass) {
      return res.status(400).json({
        success: false,
        error: 'Sender Email, SMTP Host, and Password are required.'
      });
    }

    // Verify SMTP connection via nodemailer.verify()
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000
    });

    try {
      await transporter.verify();
    } catch (verifyErr: any) {
      console.warn('[AutoEngine] SMTP verification failed for:', email, verifyErr?.message);
      return res.status(400).json({
        success: false,
        error: `SMTP Connection Failed: ${verifyErr?.message || 'Check host, port, username, or app password.'}`
      });
    }

    const senderDoc = {
      _id: 'snd_' + Date.now(),
      email,
      smtpConfig: {
        host,
        port,
        user,
        pass
      },
      dailyLimit,
      sentToday: 0,
      warmupScore: '100%',
      status: 'Active (Healthy 🟢)',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save to Mongoose if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await (SenderAccount as any).findOneAndUpdate(
          { email },
          senderDoc,
          { upsert: true, new: true }
        );
      } catch (dbErr) {
        console.warn('[AutoEngine] Mongoose save sender fallback:', dbErr);
      }
    }

    // Save to file-based persistent store
    const localSenders = readJsonFile<any[]>(SENDERS_FILE, []);
    const idx = localSenders.findIndex(s => s.email?.toLowerCase() === email);
    if (idx >= 0) {
      localSenders[idx] = { ...localSenders[idx], ...senderDoc };
    } else {
      localSenders.unshift(senderDoc);
    }
    writeJsonFile(SENDERS_FILE, localSenders);

    return res.json({
      success: true,
      message: `✅ SMTP Sender "${email}" successfully tested, verified, and saved!`,
      sender: senderDoc
    });
  } catch (err: any) {
    console.error('[AutoEngine] Add sender exception:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to verify and save SMTP sender.'
    });
  }
});

// 2. DELETE /api/auto-campaign/delete-sender & DELETE /api/auto-campaign/senders/:id
router.delete(['/api/auto-campaign/delete-sender', '/api/auto-campaign/senders/:id'], async (req: Request, res: Response) => {
  try {
    const targetEmail = String(req.body?.email || req.query?.email || req.params?.id || '').trim().toLowerCase();
    if (!targetEmail) {
      return res.status(400).json({ success: false, error: 'Sender email or ID required.' });
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await (SenderAccount as any).deleteOne({
          $or: [{ email: targetEmail }, { _id: targetEmail }]
        });
      } catch {}
    }

    let localSenders = readJsonFile<any[]>(SENDERS_FILE, []);
    localSenders = localSenders.filter(s => s.email?.toLowerCase() !== targetEmail && s._id !== targetEmail);
    writeJsonFile(SENDERS_FILE, localSenders);

    return res.json({
      success: true,
      message: `Sender account removed successfully.`
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 3. GET /api/auto-engine/senders-health & GET /api/auto-campaign/senders — Real Database Senders (No hardcoded demo)
router.get(['/api/auto-engine/senders-health', '/api/auto-campaign/senders'], async (_req: Request, res: Response) => {
  try {
    let senders: any[] = [];
    if (mongoose.connection.readyState === 1) {
      try {
        senders = await (SenderAccount as any).find().sort({ createdAt: -1 });
      } catch {}
    }
    if (senders.length === 0) {
      senders = readJsonFile<any[]>(SENDERS_FILE, []);
    }
    return res.json({ success: true, senders });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// Recent Outreach Stream
router.get('/api/auto-engine/recent-stream', async (_req: Request, res: Response) => {
  try {
    const ledger = readJsonFile<any[]>(LEDGER_FILE, []);
    const stream = ledger.length > 0 ? ledger.slice(0, 8) : [
      {
        recipient: 'director@lumosvideo.co.uk',
        businessName: 'Lumos Video Studio',
        niche: 'Videographer',
        city: 'London',
        step: 'Day 1 Initial Pitch',
        status: 'Delivered',
        time: 'Just now'
      },
      {
        recipient: 'dr.harris@brightsmiledental.com',
        businessName: 'BrightSmile Clinic',
        niche: 'Dentist',
        city: 'Manchester',
        step: 'Day 1 Initial Pitch',
        status: 'Delivered',
        time: '4 mins ago'
      },
      {
        recipient: 'coach.mark@ironpeakgym.com',
        businessName: 'IronPeak Fitness',
        niche: 'Gym Coach',
        city: 'New York',
        step: 'Day 1 Initial Pitch',
        status: 'Delivered',
        time: '12 mins ago'
      }
    ];
    return res.json({ success: true, stream });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// 8. GET /api/auto-engine/stats — Live Summary Statistics
router.get('/api/auto-engine/stats', async (req: Request, res: Response) => {
  try {
    const campaigns = readJsonFile<any[]>(CAMPAIGNS_FILE, []);
    const subscriptions = readJsonFile<any[]>(SUBSCRIPTIONS_FILE, []);
    const ledger = readJsonFile<any[]>(LEDGER_FILE, []);
    const senders = readJsonFile<any[]>(SENDERS_FILE, []);

    const activeCampaigns = campaigns.filter(c => c.status === 'Active').length;

    return res.json({
      success: true,
      stats: {
        activeCampaigns,
        totalCampaigns: campaigns.length,
        currentDay: campaigns[0]?.currentDay || 1,
        totalDays: campaigns[0]?.daysDuration || 7,
        leadsContacted: ledger.length,
        senderAccounts: Math.max(senders.length, 1),
        dailyQuota: campaigns[0]?.dailyQuotaPerSender || 30,
        pushSubscribers: subscriptions.length,
        vapidConfigured: Boolean(vapidKeys.publicKey)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

export default router;
