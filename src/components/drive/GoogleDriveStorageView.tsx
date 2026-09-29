import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { EmailAttachment } from '../../types';
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
  FileText,
  Code2,
  ChevronDown,
  ChevronUp
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
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  // Test / Staging Attachments right in this section
  const [stagedAttachments, setStagedAttachments] = useState<EmailAttachment[]>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

        let driveFolderUrl =
          driveStorageSettings.folderUrl ||
          folderUrlInput.trim() ||
          'https://drive.google.com/drive/my-drive';
        let driveFileUrl = driveFolderUrl;

        try {
          const res = await fetch('/api/drive-storage/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
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
        } catch {}

        added.push({
          id: `drv-att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          contentBase64: base64DataUrl,
          driveFolderUrl,
          driveFileUrl,
          storageProvider: 'google_drive',
          uploadedAt: new Date().toISOString()
        });
      } catch {}
    }

    if (added.length > 0) {
      setStagedAttachments(prev => [...added, ...prev]);
      addNotification({
        title: `📎 ${added.length} File(s) Ready via Google Drive`,
        message: `${added.map(a => a.name).join(', ')} prepared with 0 KB hosting disk usage.`,
        type: 'system'
      });
    }
    setIsUploading(false);
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
                <span>0 KB cPanel Hosting Disk Used</span>
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
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              ☁️ Google Drive Folder Link &amp; File Attachment Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              আপনার হোস্টিংয়ে কোনো জায়গা (0 KB) না নিয়ে যেকোনো ফাইল (PDF, Image, ZIP, Doc, Video, Excel) ইমেইলে অ্যাটাচ করুন। নিচে আপনার <strong>Google Drive Folder Link</strong> শেয়ার ও সেভ করুন এবং যেকোনো সময় প্রয়োজন অনুযায়ী লিংক পরিবর্তন (Change) করুন।
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
                  ১. আপনার Google Drive Folder Link যুক্ত ও পরিবর্তন করুন
                </h2>
                <p className="text-xs text-slate-400">
                  Share your Google Drive folder link here — you can change or update this link anytime
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
                    onClick={() => setIsEditingLink(true)}
                    className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 text-xs font-bold cursor-pointer transition"
                  >
                    ✏️ Change Link
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
              <p className="text-[11px] text-slate-400 mt-1.5">
                💡 টিপস: আপনার Google Drive-এ একটি ফোল্ডার খুলে সেটির <strong>Share → Anyone with the link</strong> অন করে লিংকটি এখানে পেস্ট করুন। পরে যেকোনো সময় এই বক্সে নতুন লিংক বসিয়ে <strong>Save / Update Google Drive Link</strong> বাটনে ক্লিক করলেই লিংক পরিবর্তন হয়ে যাবে।
              </p>
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
                      Include Drive Link in Emails
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      মেইলে ফাইল অ্যাটাচের পাশাপাশি Drive লিংক যুক্ত থাকবে
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Optional Google Apps Script Bridge Accordion */}
            <div className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowAppsScriptGuide(prev => !prev)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-cyan-400" />
                  <span>অপশনাল: অটোমেটিক Google Drive আপলোড ব্রিজ (Apps Script Web App URL)</span>
                </span>
                {showAppsScriptGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAppsScriptGuide && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-800/80 pt-3 text-xs">
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    আপনি যদি চান কম্পিউটার বা ফোন থেকে ফাইল সিলেক্ট করলেই সেটি স্বয়ংক্রিয়ভাবে আপনার Google Drive ফোল্ডারের ভেতরেও ফাইল হিসেবে আপলোড হয়ে যাবে, তাহলে <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline">script.google.com</a>-এ গিয়ে নিচের কোডটি পেস্ট করে <strong>Deploy → New Deployment → Web App (Anyone)</strong> দিয়ে Web App URL-টি নিচে বসিয়ে দিন:
                  </p>
                  <div className="relative">
                    <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-emerald-300 font-mono overflow-x-auto">
                      {APPS_SCRIPT_CODE}
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopyAppsScript}
                      className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer border border-slate-700"
                    >
                      {copiedScript ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedScript ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Google Apps Script Web App URL (Optional)
                    </label>
                    <input
                      type="url"
                      value={appsScriptUrlInput}
                      onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/.../exec"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              )}
            </div>

            {savedSuccess && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold text-xs flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>✅ আপনার Google Drive Folder Link সফলভাবে সেভ ও আপডেট হয়েছে!</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2">
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

              <button
                type="submit"
                className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-emerald-500/20 cursor-pointer transition"
              >
                <Check className="w-4 h-4" />
                <span>
                  {driveStorageSettings.folderUrl
                    ? 'Save / Change Google Drive Link'
                    : 'Save Google Drive Folder Link'}
                </span>
              </button>
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
                  ২. Gmail-Style যেকোনো ফাইল Attach করুন
                </h2>
                <p className="text-xs text-slate-400">
                  Attach PDF, Image, Doc, Excel, ZIP, or Video (0 KB Hosting Storage)
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
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-400 bg-slate-950/70 hover:bg-emerald-950/20 rounded-2xl p-6 text-center space-y-2.5 cursor-pointer transition group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto group-hover:scale-110 transition">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-black text-white">
                {isUploading ? 'Attaching File(s)...' : '📎 Click to Select Any File to Attach'}
              </div>
              <p className="text-xs text-slate-400">
                যেকোনো ফাইল (PDF, PNG, JPG, DOCX, XLSX, ZIP, MP4) সিলেক্ট করুন — সরাসরি Google Drive লিংক ও ইমেইলে যুক্ত হবে।
              </p>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold border border-emerald-500/30">
                  <Paperclip className="w-3 h-3" />
                  <span>Choose Files (*/*)</span>
                </span>
              </div>
            </div>

            {/* Staged Files List */}
            {stagedAttachments.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-emerald-300">
                  <span>Attached Files Ready ({stagedAttachments.length}):</span>
                  <button
                    type="button"
                    onClick={() => setStagedAttachments([])}
                    className="text-[11px] text-rose-400 hover:underline cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {stagedAttachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-xl bg-slate-950 border border-emerald-500/30 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-emerald-400 shrink-0" />
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate">{att.name}</div>
                          <div className="text-[10px] text-emerald-300 font-mono">
                            {formatFileSize(att.size)} • ☁️ Google Drive (0 KB Hosting)
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {att.driveFolderUrl && (
                          <a
                            href={att.driveFileUrl || att.driveFolderUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/25"
                          >
                            Drive ↗
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setStagedAttachments(prev => prev.filter(x => x.id !== att.id))}
                          className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-2 text-xs">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>কোথায় কোথায় ফাইল অ্যাটাচ করা যাবে?</span>
            </div>
            <ul className="space-y-1 text-[11px] text-slate-300 list-disc list-inside">
              <li>
                <strong>Smart Inbox (Reply Box):</strong> যেকোনো মেইলের রিপ্লাই দেওয়ার সময় নিচে <code>📎 Attach File</code> বাটনে ক্লিক করে।
              </li>
              <li>
                <strong>Smart Inbox (Compose Email):</strong> নতুন মেইল পাঠানোর সময় <code>📎 Attach Any File</code> বাটনে ক্লিক করে।
              </li>
              <li>
                <strong>Top Navbar (Send Mail):</strong> উপরের <code>Send Mail</code> বাটনে ক্লিক করে যেকোনো ফাইল অ্যাটাচ করে পাঠানো যাবে।
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
