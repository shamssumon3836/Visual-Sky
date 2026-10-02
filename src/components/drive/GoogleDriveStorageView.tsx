import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import {
  FolderOpen,
  Link2,
  Check,
  CheckCircle2,
  ExternalLink,
  Trash2,
  Copy,
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

export const GoogleDriveStorageView: React.FC<GoogleDriveStorageViewProps> = () => {
  const {
    driveStorageSettings,
    updateDriveStorageSettings,
    addNotification
  } = useApp();

  const [folderUrlInput, setFolderUrlInput] = useState<string>(driveStorageSettings.folderUrl || '');
  const [appsScriptUrlInput, setAppsScriptUrlInput] = useState<string>(
    driveStorageSettings.appsScriptWebAppUrl || ''
  );
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  useEffect(() => {
    setFolderUrlInput(driveStorageSettings.folderUrl || '');
    setAppsScriptUrlInput(driveStorageSettings.appsScriptWebAppUrl || '');
  }, [driveStorageSettings.folderUrl, driveStorageSettings.appsScriptWebAppUrl]);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = folderUrlInput.trim();
    const cleanScriptUrl = appsScriptUrlInput.trim();
    updateDriveStorageSettings({
      folderUrl: cleanUrl,
      appsScriptWebAppUrl: cleanScriptUrl,
      autoIncludeDriveLinkInEmail: true
    });
    setSavedSuccess(true);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.3 } });
    addNotification({
      title: '✅ Google Drive Link Saved',
      message: 'এখন মেইলে Attach File করলে ফাইলগুলো স্বয়ংক্রিয়ভাবে আপনার এই Google Drive লিংকে আপলোড হবে।',
      type: 'system'
    });
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const handleCopyAppsScript = () => {
    navigator.clipboard.writeText(APPS_SCRIPT_CODE);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  return (
    <div className="p-4 md:p-8 max-w-2xl mx-auto animate-in fade-in duration-200">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-white">
                Google Drive Folder Link
              </h1>
              <p className="text-xs text-slate-400">
                মেইলে Attach File করলে ফাইলগুলো আপনার এই Google Drive লিংকে আপলোড হবে (হোস্টিংয়ে কোনো জায়গা খাবে না)
              </p>
            </div>
          </div>

          {driveStorageSettings.folderUrl && (
            <a
              href={driveStorageSettings.folderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <span>Open Drive</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-slate-200 mb-1.5">
              Google Drive Folder Link *
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

          {/* Optional Apps Script Auto-Upload Bridge */}
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAppsScriptGuide(prev => !prev)}
              className="w-full px-4 py-2.5 flex items-center justify-between text-left text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>Direct Auto-Upload Script URL (Optional)</span>
              </span>
              {showAppsScriptGuide ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
            </button>

            {showAppsScriptGuide && (
              <div className="px-4 pb-4 space-y-3 border-t border-slate-800 pt-3 text-xs">
                <div className="relative">
                  <pre className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-emerald-300 font-mono overflow-x-auto max-h-36">
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
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Google Apps Script Web App URL
                  </label>
                  <input
                    type="url"
                    value={appsScriptUrlInput}
                    onChange={(e) => setAppsScriptUrlInput(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>
            )}
          </div>

          {savedSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 font-bold text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>✅ Google Drive লিংক সফলভাবে সেভ হয়েছে!</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-1">
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
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs sm:text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer transition"
            >
              <Check className="w-4 h-4" />
              <span>Save Link</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
