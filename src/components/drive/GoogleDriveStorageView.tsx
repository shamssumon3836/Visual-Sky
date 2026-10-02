import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { EmailAttachment } from '../../types';
import {
  getFastAttachmentViewSrc,
  buildAttachmentDownloadUrl,
  warmAttachmentInBackground,
  triggerInstantAttachmentDownload
} from '../../utils/attachmentFastCache';
import {
  FolderOpen,
  Link2,
  Paperclip,
  Check,
  CheckCircle2,
  ExternalLink,
  Upload,
  Trash2,
  Send,
  Inbox,
  Sparkles,
  ShieldCheck,
  Copy,
  RefreshCw,
  HardDrive,
  Code2,
  ChevronDown,
  ChevronUp,
  Eye,
  Download,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface GoogleDriveStorageViewProps {
  onOpenSendMail?: () => void;
}

const APPS_SCRIPT_CODE = `function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var folderId = data.folderId;
    var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
    var decoded = Utilities.base64Decode(data.base64);
    var blob = Utilities.newBlob(decoded, data.mimeType || 'application/octet-stream', data.fileName || 'attachment');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      id: file.getId(),
      fileUrl: file.getUrl()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export const GoogleDriveStorageView: React.FC<GoogleDriveStorageViewProps> = ({ onOpenSendMail }) => {
  const {
    threads,
    driveStorageSettings,
    updateDriveStorageSettings,
    setActiveTab,
    addNotification
  } = useApp();

  const [folderUrlInput, setFolderUrlInput] = useState<string>(driveStorageSettings.folderUrl || '');
  const [folderNameInput, setFolderNameInput] = useState<string>(
    driveStorageSettings.folderName || 'My Google Drive Email Attachments'
  );
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState<string>(
    driveStorageSettings.appsScriptWebAppUrl || ''
  );
  const [autoIncludeLink, setAutoIncludeLink] = useState<boolean>(
    driveStorageSettings.autoIncludeDriveLinkInEmail !== false
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isEditingLink, setIsEditingLink] = useState<boolean>(!driveStorageSettings.folderUrl);
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState<boolean>(
    !driveStorageSettings.appsScriptWebAppUrl
  );
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Test / Staging Attachments right in this section
  const [stagedAttachments, setStagedAttachments] = useState<EmailAttachment[]>([]);
  const [serverFiles, setServerFiles] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isDraggingOverDrive, setIsDraggingOverDrive] = useState<boolean>(false);
  const [isTestingDrive, setIsTestingDrive] = useState<boolean>(false);
  const [syncingAttachmentId, setSyncingAttachmentId] = useState<string | null>(null);
  const [previewAtt, setPreviewAtt] = useState<EmailAttachment | null>(null);
  const [previewBlobReadyUrl, setPreviewBlobReadyUrl] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchServerFiles = async () => {
    try {
      const res = await fetch('/api/drive-storage/files');
      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.files)) {
        setServerFiles(data.files);
      }
    } catch {}
  };

  useEffect(() => {
    fetchServerFiles();
  }, []);

  useEffect(() => {
    setFolderUrlInput(driveStorageSettings.folderUrl || '');
    setFolderNameInput(driveStorageSettings.folderName || 'My Google Drive Email Attachments');
    setAppsScriptUrlInput(driveStorageSettings.appsScriptWebAppUrl || '');
    setAutoIncludeLink(driveStorageSettings.autoIncludeDriveLinkInEmail !== false);
  }, [
    driveStorageSettings.folderUrl,
    driveStorageSettings.folderName,
    driveStorageSettings.appsScriptWebAppUrl,
    driveStorageSettings.autoIncludeDriveLinkInEmail
  ]);

  // Combine attachments from threads + serverFiles + stagedAttachments
  const allVaultAttachments: EmailAttachment[] = React.useMemo(() => {
    const map = new Map<string, EmailAttachment>();
    for (const st of stagedAttachments) {
      map.set(st.id, st);
    }
    for (const sf of serverFiles) {
      if (sf && sf.id && !map.has(sf.id)) {
        map.set(sf.id, {
          id: sf.id,
          name: sf.name || 'Attachment',
          size: Number(sf.size || 0),
          mimeType: sf.mimeType || 'application/octet-stream',
          viewUrl: sf.viewUrl || `/api/attachments/view/${encodeURIComponent(sf.id)}`,
          downloadUrl: sf.downloadUrl || `/api/attachments/download/${encodeURIComponent(sf.id)}`,
          driveFolderUrl: sf.driveFolderUrl || driveStorageSettings.folderUrl,
          driveFileUrl: sf.driveFileUrl || '',
          uploadedToDrive: Boolean(sf.uploadedToDrive),
          uploadedAt: sf.uploadedAt
        });
      }
    }
    for (const t of threads) {
      for (const m of t.messages || []) {
        const atts = m.attachments || [];
        for (let idx = 0; idx < atts.length; idx++) {
          const a = atts[idx];
          if (a && a.id && !map.has(a.id)) {
            map.set(a.id, { ...a, _msgId: String(m.id || ''), _idx: idx } as any);
          }
        }
      }
    }
    return Array.from(map.values());
  }, [stagedAttachments, serverFiles, threads, driveStorageSettings.folderUrl]);

  useEffect(() => {
    if (!previewAtt) {
      setPreviewBlobReadyUrl(null);
      return;
    }
    setPreviewBlobReadyUrl(getFastAttachmentViewSrc(previewAtt as any));
    warmAttachmentInBackground(previewAtt as any, (blobUrl) => {
      setPreviewBlobReadyUrl(blobUrl);
    });
  }, [previewAtt]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes <= 0) return '1 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateDriveStorageSettings({
      folderUrl: folderUrlInput.trim(),
      folderName: folderNameInput.trim() || 'My Google Drive Email Attachments',
      appsScriptWebAppUrl: appsScriptUrlInput.trim(),
      autoIncludeDriveLinkInEmail: autoIncludeLink
    });
    setSavedSuccess(true);
    setIsEditingLink(false);
    confetti({ particleCount: 40, spread: 65, origin: { y: 0.25 } });
    setTimeout(() => setSavedSuccess(false), 3500);
  };

  const handleSelectFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsUploading(true);
    const added: EmailAttachment[] = [];

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const base64DataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });

        const attId = `drv-att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        let driveFolderUrl =
          driveStorageSettings.folderUrl ||
          folderUrlInput.trim() ||
          'https://drive.google.com/drive/my-drive';
        let driveFileUrl = '';
        let viewUrl = `/api/attachments/view/${encodeURIComponent(attId)}`;
        let downloadUrl = `/api/attachments/download/${encodeURIComponent(attId)}`;
        let uploadedToDrive = false;

        try {
          const res = await fetch('/api/drive-storage/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: attId,
              fileName: file.name,
              mimeType: file.type || 'application/octet-stream',
              size: file.size,
              contentBase64: base64DataUrl,
              folderUrl: driveFolderUrl,
              folderId: driveStorageSettings.folderId,
              appsScriptWebAppUrl: driveStorageSettings.appsScriptWebAppUrl || appsScriptUrlInput.trim()
            })
          });
          const data = await res.json().catch(() => ({}));
          if (data?.driveFolderUrl) driveFolderUrl = data.driveFolderUrl;
          if (data?.driveFileUrl) driveFileUrl = data.driveFileUrl;
          if (data?.viewUrl) viewUrl = data.viewUrl;
          if (data?.downloadUrl) downloadUrl = data.downloadUrl;
          if (data?.uploadedToDrive) uploadedToDrive = true;
        } catch {}

        added.push({
          id: attId,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          contentBase64: base64DataUrl,
          driveFolderUrl,
          driveFileUrl: driveFileUrl || undefined,
          viewUrl,
          downloadUrl,
          uploadedToDrive,
          storageProvider: 'google_drive',
          uploadedAt: new Date().toISOString()
        });
      } catch {}
    }

    if (added.length > 0) {
      setStagedAttachments(prev => [...added, ...prev]);
      fetchServerFiles();
      const uploadedCount = added.filter(a => a.uploadedToDrive).length;
      addNotification({
        title: uploadedCount > 0
          ? `☁️ ${uploadedCount} File(s) Uploaded to Google Drive Folder!`
          : `📎 ${added.length} File(s) Ready (View & Download Active)`,
        message: uploadedCount > 0
          ? `${added.map(a => a.name).join(', ')} added directly inside your Google Drive folder.`
          : `${added.map(a => a.name).join(', ')} ready. Add the Apps Script Web App URL below to auto-create files inside your Google Drive folder.`,
        type: 'system'
      });
    }
    setIsUploading(false);
  };

  const handleTestDriveUpload = async () => {
    const activeFolderUrl = folderUrlInput.trim() || driveStorageSettings.folderUrl;
    const activeScriptUrl = appsScriptUrlInput.trim() || driveStorageSettings.appsScriptWebAppUrl;

    if (!activeFolderUrl) {
      addNotification({
        title: '⚠️ Google Drive Folder Link Required',
        message: 'আগে আপনার Google Drive Folder Link পেস্ট করুন।',
        type: 'system'
      });
      return;
    }

    setIsTestingDrive(true);
    try {
      // Save settings first
      updateDriveStorageSettings({
        folderUrl: activeFolderUrl,
        folderName: folderNameInput.trim() || 'My Google Drive Email Attachments',
        appsScriptWebAppUrl: activeScriptUrl,
        autoIncludeDriveLinkInEmail: autoIncludeLink
      });

      const sampleContent = `Visual Sky Google Drive Auto-Upload Verification\nConnected Folder: ${activeFolderUrl}\nTimestamp: ${new Date().toISOString()}\nStatus: Active & Verified`;
      const base64Sample = `data:text/plain;base64,${btoa(sampleContent)}`;
      const testId = `drv-test-${Date.now()}`;

      const res = await fetch('/api/drive-storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: testId,
          fileName: `Visual-Sky-Drive-Test-${new Date().toISOString().slice(0, 10)}.txt`,
          mimeType: 'text/plain',
          size: sampleContent.length,
          contentBase64: base64Sample,
          folderUrl: activeFolderUrl,
          appsScriptWebAppUrl: activeScriptUrl
        })
      });
      const data = await res.json().catch(() => ({}));
      fetchServerFiles();

      if (data?.uploadedToDrive) {
        confetti({ particleCount: 55, spread: 70, origin: { y: 0.3 } });
        addNotification({
          title: '✅ File Created Inside Your Google Drive Folder!',
          message: 'আপনার Google Drive ফোল্ডারে টেস্ট ফাইল সফলভাবে আপলোড হয়েছে! ফোল্ডারটি ওপেন করে দেখুন।',
          type: 'system'
        });
      } else {
        setShowAppsScriptGuide(true);
        addNotification({
          title: '⚠️ Google Drive Write Bridge Needed',
          message: data?.driveUploadError
            ? `Google Drive Error: ${data.driveUploadError}`
            : 'শুধু ফোল্ডার লিংক দিলে Google বাহির থেকে ফাইল তৈরি করতে দেয় না। নিচের ১ মিনিটের Apps Script Web App URL বসিয়ে সেভ করলেই সরাসরি আপনার ফোল্ডারে ফাইল অ্যাড হবে!',
          type: 'system'
        });
      }
    } catch (err: any) {
      addNotification({
        title: '⚠️ Test Failed',
        message: err?.message || 'Could not reach server.',
        type: 'system'
      });
    } finally {
      setIsTestingDrive(false);
    }
  };

  const handleSyncSingleAttachment = async (att: EmailAttachment) => {
    setSyncingAttachmentId(att.id);
    try {
      const res = await fetch('/api/drive-storage/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: att.id,
          fileName: att.name,
          mimeType: att.mimeType || 'application/octet-stream',
          size: att.size,
          contentBase64: att.contentBase64,
          folderUrl: folderUrlInput.trim() || driveStorageSettings.folderUrl,
          appsScriptWebAppUrl: appsScriptUrlInput.trim() || driveStorageSettings.appsScriptWebAppUrl
        })
      });
      const data = await res.json().catch(() => ({}));
      fetchServerFiles();
      if (data?.uploadedToDrive) {
        confetti({ particleCount: 35, spread: 60, origin: { y: 0.35 } });
        addNotification({
          title: '☁️ Uploaded to Your Google Drive Folder!',
          message: `"${att.name}" এখন আপনার Google Drive ফোল্ডারে যোগ হয়েছে।`,
          type: 'system'
        });
      } else {
        setShowAppsScriptGuide(true);
        addNotification({
          title: '⚠️ Apps Script Web App URL Needed',
          message: 'আপনার Google Drive ফোল্ডারে ফাইল রাইট করার জন্য নিচের বক্সে Apps Script Web App URL পেস্ট করে সেভ করুন।',
          type: 'system'
        });
      }
    } catch {}
    setSyncingAttachmentId(null);
  };

  const getVaultAttachmentViewUrl = (att: EmailAttachment & { _msgId?: string; _idx?: number }): string => {
    if (!att) return '';
    return getFastAttachmentViewSrc(att);
  };

  const getVaultAttachmentDownloadUrl = (att: EmailAttachment & { _msgId?: string; _idx?: number }): string => {
    if (!att) return '';
    return buildAttachmentDownloadUrl(att);
  };

  const handleDownload = (att: EmailAttachment & { _msgId?: string; _idx?: number }) => {
    if (!att) return;
    const key = att.id || att.name || 'att';
    setDownloadingId(key);
    setTimeout(() => {
      setDownloadingId(prev => (prev === key ? null : prev));
    }, 1200);

    const started = triggerInstantAttachmentDownload(att);
    if (!started) {
      const fileName = att.name || 'attachment';
      addNotification({
        title: '⚠️ Syncing Attachment...',
        message: `Fetching "${fileName}" from mail server. Please try again in a moment.`,
        type: 'system'
      });
    }
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950/70 via-[#091526] to-cyan-950/60 border border-emerald-500/40 p-6 sm:p-8 shadow-2xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Google Drive Attachment Engine</span>
              </span>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>View, Download &amp; Auto-Upload to Drive</span>
              </span>
              {driveStorageSettings.folderUrl ? (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-400 text-slate-950 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Drive Folder Linked ✓</span>
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  ⚠️ Drive Link Not Set Yet
                </span>
              )}
              {driveStorageSettings.appsScriptWebAppUrl && (
                <span className="px-3 py-1 rounded-full text-xs font-black bg-cyan-400 text-slate-950 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Auto-Upload Bridge Active ✓</span>
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ☁️ Google Drive Folder Link &amp; File Attachment Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              যেকোনো ইমেইলে আসা বা পাঠানো ছবি ও ফাইল সরাসরি <strong>View / Download</strong> করুন এবং আপনার <strong>Google Drive Folder</strong>-এ অটোমেটিক ফাইল হিসেবে সেভ করুন।
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('inbox')}
              className="px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition"
            >
              <Inbox className="w-4 h-4" />
              <span>Go to Smart Inbox</span>
            </button>
            {onOpenSendMail && (
              <button
                type="button"
                onClick={onOpenSendMail}
                className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition"
              >
                <Send className="w-4 h-4 text-cyan-400" />
                <span>Compose Mail + Attach File</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Left = Google Drive Link Share & Change Card, Right = File Attachment Tester */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT 7 COLS: SHARE & CHANGE GOOGLE DRIVE FOLDER LINK */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4 gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <FolderOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">
                  ১. আপনার Google Drive Folder Link ও Auto-Upload সেটআপ
                </h2>
                <p className="text-xs text-slate-400">
                  Connect your Google Drive folder and enable automatic file creation inside it
                </p>
              </div>
            </div>

            {driveStorageSettings.folderUrl && !isEditingLink && (
              <button
                type="button"
                onClick={() => setIsEditingLink(true)}
                className="px-3.5 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Change Google Drive Link</span>
              </button>
            )}
          </div>

          {/* Current Connected Folder Status Box */}
          {driveStorageSettings.folderUrl && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] uppercase">
                    ✓ Active Connected Drive Folder
                  </span>
                  <span className="text-xs font-bold text-emerald-200">
                    {driveStorageSettings.folderName || 'My Google Drive Email Attachments'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={driveStorageSettings.folderUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-200 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <span>Open Folder in Google Drive</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={handleTestDriveUpload}
                    disabled={isTestingDrive}
                    className="px-3 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black cursor-pointer transition disabled:opacity-50"
                  >
                    {isTestingDrive ? 'Testing...' : '🧪 Test Upload to Drive'}
                  </button>
                </div>
              </div>
              <div className="text-xs font-mono text-slate-300 bg-slate-950/90 px-3 py-2 rounded-xl border border-slate-800 break-all">
                {driveStorageSettings.folderUrl}
              </div>
              {driveStorageSettings.updatedAt && (
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Folder ID: <code className="text-emerald-300">{driveStorageSettings.folderId || 'Linked'}</code></span>
                  <span>Last Updated: {new Date(driveStorageSettings.updatedAt).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}

          {/* Form to Add or Change Google Drive Folder Link */}
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-extrabold text-slate-200 mb-1.5">
                Google Drive Shared Folder Link (এখানে আপনার Google Drive ফোল্ডারের লিংক পেস্ট করুন) *
              </label>
              <div className="relative">
                <Link2 className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="url"
                  required
                  value={folderUrlInput}
                  onChange={(e) => setFolderUrlInput(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz?usp=sharing"
                  className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-2xl pl-10 pr-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400 transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Folder Label / নাম (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  placeholder="My Google Drive Email Attachments"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex items-end">
                <label className="w-full flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoIncludeLink}
                    onChange={(e) => setAutoIncludeLink(e.target.checked)}
                    className="rounded border-slate-700 text-emerald-500 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                  />
                  <div className="min-w-0">
                    <div className="font-bold text-slate-200 text-xs truncate">
                      Include Download/Drive Link in Emails
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      মেইলে ফাইল অ্যাটাচের পাশাপাশি ডিরেক্ট ফাইল লিংক যুক্ত থাকবে
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* IMPORTANT: Google Apps Script Bridge for Direct Folder File Creation */}
            <div className="rounded-2xl bg-cyan-950/25 border border-cyan-500/40 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAppsScriptGuide(prev => !prev)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-black text-cyan-200 hover:text-white cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>
                    ⚡ আপনার Google Drive ফোল্ডারের ভেতরে ফাইল অটোমেটিক অ্যাড করার ব্রিজ (Apps Script Web App URL)
                  </span>
                </span>
                {showAppsScriptGuide ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
              </button>

              {showAppsScriptGuide && (
                <div className="px-4 pb-4 space-y-3 border-t border-cyan-500/30 pt-3 text-xs">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 leading-relaxed">
                    <strong>কেন শুধু ফোল্ডার লিংক দিলে ফাইল যোগ হয় না?</strong> Google-এর সিকিউরিটি নিয়ম অনুযায়ী শুধু ফোল্ডার লিংক দিয়ে বাহিরের সার্ভার থেকে সরাসরি কারো Google Drive-এ ফাইল আপলোড করা যায় না। নিচের ১ মিনিটের Apps Script টি যুক্ত করলেই আপনার মেইলে আসা ও পাঠানো সব ফাইল স্বয়ংক্রিয়ভাবে আপনার ওই Google Drive ফোল্ডারের ভেতরে চলে যাবে!
                  </div>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
                    <li>
                      <a href="https://script.google.com/home/start" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-bold">
                        script.google.com
                      </a>{' '}
                      ওপেন করে <strong>New Project</strong> ক্লিক করুন।
                    </li>
                    <li>নিচের কোডটি <strong>Copy Code</strong> করে সেখানে পেস্ট করুন এবং Save করুন।</li>
                    <li>
                      উপরে ডানদিকে <strong>Deploy → New deployment → Select type: Web app</strong> দিন।
                    </li>
                    <li>
                      <strong>Who has access: Anyone</strong> সিলেক্ট করে Deploy করুন এবং <strong>Web App URL</strong> কপি করে নিচের বক্সে পেস্ট করুন:
                    </li>
                  </ol>
                  <div className="relative">
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[10px] text-emerald-300 font-mono overflow-x-auto max-h-40">
                      {APPS_SCRIPT_CODE}
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopyAppsScript}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[10px] font-black flex items-center gap-1 cursor-pointer shadow"
                    >
                      {copiedScript ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedScript ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-extrabold text-cyan-200 mb-1">
                      Google Apps Script Web App URL (এখানে পেস্ট করুন)
                    </label>
                    <input
                      type="url"
                      value={appsScriptUrlInput}
                      onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="w-full bg-slate-950 border border-cyan-500/40 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {savedSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>✅ আপনার Google Drive Folder Link ও সেটিংস সফলভাবে সেভ হয়েছে!</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 flex-wrap">
              {driveStorageSettings.folderUrl ? (
                <button
                  type="button"
                  onClick={() => {
                    setFolderUrlInput('');
                    updateDriveStorageSettings({ folderUrl: '', folderId: '' });
                  }}
                  className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-700/50 text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Link</span>
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTestDriveUpload}
                  disabled={isTestingDrive}
                  className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-cyan-500/40 text-cyan-300 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
                >
                  <span>{isTestingDrive ? 'Uploading Test File...' : '🧪 Test Upload to Drive'}</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer transition"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Drive Settings</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* RIGHT 5 COLS: TEST & ATTACH ANY FILE (GMAIL STYLE) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Paperclip className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-black text-white">
                  ২. যেকোনো ফাইল ও ছবি Upload / Attach করুন
                </h2>
                <p className="text-xs text-slate-400">
                  Upload PDF, Image, Doc, Excel, ZIP, or Video — View, Download &amp; Sync to Drive
                </p>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="*/*"
              onChange={(e) => {
                handleSelectFiles(e.target.files);
                e.target.value = '';
              }}
              className="hidden"
            />

            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverDrive(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverDrive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverDrive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingOverDrive(false);
                if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                  handleSelectFiles(e.dataTransfer.files);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-6 text-center space-y-2.5 cursor-pointer transition group ${
                isDraggingOverDrive
                  ? 'border-emerald-400 bg-emerald-500/15 scale-[1.01]'
                  : 'border-emerald-500/40 hover:border-emerald-400 bg-slate-950/70 hover:bg-emerald-950/20'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto group-hover:scale-110 transition">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-black text-white">
                {isUploading
                  ? 'Uploading & Syncing File(s)...'
                  : isDraggingOverDrive
                  ? '📂 ফাইলগুলো এখানে ছেড়ে দিন (Drop Files Here)...'
                  : '📎 Drag & Drop Files Here or Click to Browse'}
              </div>
              <p className="text-xs text-slate-400">
                যেকোনো ফাইল (PDF, PNG, JPG, DOCX, XLSX, ZIP, MP4) এখানে Drag &amp; Drop করুন অথবা ক্লিক করে ফোল্ডার থেকে সিলেক্ট করুন — সরাসরি আপনার Google Drive ফোল্ডারে যুক্ত হবে।
              </p>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black shadow">
                  <Paperclip className="w-3 h-3" />
                  <span>Browse / Select from Folder</span>
                </span>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>ইমেইল অ্যাটাচমেন্ট ও ছবি যেভাবে কাজ করে:</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
              <li>
                <strong>Incoming Mail Images &amp; Files:</strong> কেউ আপনাকে মেইলে ছবি বা ফাইল পাঠালে Smart Inbox-এ সাথে সাথে ছবি দেখা যাবে এবং <code>View</code> ও <code>Download</code> বাটনে ক্লিক করে ডাউনলোড করা যাবে।
              </li>
              <li>
                <strong>Auto-Save to Google Drive:</strong> আপনার Google Drive ব্রিজ যুক্ত থাকলে মেইলে আসা ও পাঠানো সব ফাইল স্বয়ংক্রিয়ভাবে আপনার Google Drive ফোল্ডারের ভেতরেও জমা হবে।
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* ALL EMAIL ATTACHMENTS & GOOGLE DRIVE FILES VAULT */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                ৩. Email Attachments &amp; Google Drive Files ({allVaultAttachments.length})
              </h2>
              <p className="text-xs text-slate-400">
                আপনার ইনবক্সে আসা এবং আপনার পাঠানো সকল ছবি ও ফাইল এখান থেকে View, Download এবং Google Drive-এ Sync করুন
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchServerFiles}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Files</span>
          </button>
        </div>

        {allVaultAttachments.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs border border-dashed border-slate-800 rounded-2xl">
            এখনো কোনো ফাইল বা ইমেইল অ্যাটাচমেন্ট নেই। উপরে ফাইল আপলোড করুন অথবা Smart Inbox-এ মেইল সিঙ্ক করুন।
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {allVaultAttachments.map((att) => {
              const isImg =
                String(att.mimeType || '').toLowerCase().startsWith('image/') ||
                /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(att.name || '');

              return (
                <div
                  key={att.id}
                  onMouseEnter={() => warmAttachmentInBackground(att as any)}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 flex flex-col justify-between gap-3 transition"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                      <Paperclip className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-white truncate" title={att.name}>
                        {isImg ? '🖼️ ' : '📄 '}{att.name}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatFileSize(att.size)} • {att.uploadedToDrive ? '☁️ Saved in Drive' : '📦 Ready'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-slate-900">
                    <button
                      type="button"
                      onClick={() => setPreviewAtt(att)}
                      className="px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(att as any)}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-[11px] font-black flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>{downloadingId === (att.id || att.name || 'att') ? 'Downloading...' : 'Download'}</span>
                    </button>
                    {att.uploadedToDrive && att.driveFileUrl ? (
                      <a
                        href={att.driveFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex items-center gap-1"
                      >
                        <span>Drive File ↗</span>
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSyncSingleAttachment(att)}
                        disabled={syncingAttachmentId === att.id}
                        className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <span>{syncingAttachmentId === att.id ? 'Syncing...' : '☁️ Add to Drive'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal (Opened Only When User Clicks View) */}
      {previewAtt && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setPreviewAtt(null)}
        >
          <div
            className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="text-xs font-black text-white truncate">{previewAtt.name}</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(previewAtt as any)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <a
                  href={getVaultAttachmentViewUrl(previewAtt as any)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-bold flex items-center gap-1"
                >
                  <span>Open in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewAtt(null)}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-slate-950 flex items-center justify-center min-h-[300px]">
              {String(previewAtt.mimeType || '').toLowerCase().startsWith('image/') ||
              /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(previewAtt.name || '') ? (
                <img
                  src={previewBlobReadyUrl || getVaultAttachmentViewUrl(previewAtt as any)}
                  alt={previewAtt.name}
                  decoding="sync"
                  loading="eager"
                  className="max-h-[70vh] max-w-full object-contain rounded-lg"
                />
              ) : (
                <iframe
                  src={previewBlobReadyUrl || getVaultAttachmentViewUrl(previewAtt as any)}
                  title={previewAtt.name}
                  className="w-full h-[65vh] rounded-lg bg-white border-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

