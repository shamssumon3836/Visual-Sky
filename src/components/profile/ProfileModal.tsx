import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  User, 
  Camera, 
  Lock, 
  X, 
  Check, 
  LogOut, 
  Eye, 
  EyeOff, 
  Building, 
  Phone, 
  Mail, 
  ShieldCheck, 
  AlertCircle,
  Upload,
  Trash2,
  RefreshCw
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAuth: () => void;
}

const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80'
];

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onOpenAuth }) => {
  const { 
    currentUser, 
    updateUserProfile, 
    changeUserPassword, 
    logout, 
    requestLogout,
    addNotification,
    driveStorageSettings
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'avatar' | 'security'>('profile');
  const [isDraggingAvatar, setIsDraggingAvatar] = useState<boolean>(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState<boolean>(false);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // Form Fields
  const [name, setName] = useState(currentUser.name || '');
  const [company, setCompany] = useState(currentUser.company || 'Visual Sky Media');
  const [phone, setPhone] = useState(currentUser.phone || '+1 (415) 890-4211');
  const [timezone, setTimezone] = useState('America/New_York (EST)');
  const [bio, setBio] = useState(
    currentUser.title 
      ? `${currentUser.title} at ${currentUser.company || 'Visual Sky Media'}` 
      : 'Founder & CEO | B2B Growth Architect'
  );
  const [avatar, setAvatar] = useState(currentUser.avatar || PRESET_AVATARS[0]);
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');

  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');

  useEffect(() => {
    setName(currentUser.name || '');
    setCompany(currentUser.company || 'Visual Sky Media');
    setPhone(currentUser.phone || '+1 (415) 890-4211');
    setAvatar(currentUser.avatar || PRESET_AVATARS[0]);
  }, [currentUser]);

  // Compress & resize uploaded image to lightweight 256x256 avatar (prevents page load slowdown & hosting bloat)
  const compressImageFileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const rawDataUrl = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
          try {
            const maxDim = 256;
            let width = img.width || maxDim;
            let height = img.height || maxDim;
            if (width > height) {
              if (width > maxDim) {
                height = Math.round((height * maxDim) / width);
                width = maxDim;
              }
            } else {
              if (height > maxDim) {
                width = Math.round((width * maxDim) / height);
                height = maxDim;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              const compressed = canvas.toDataURL('image/jpeg', 0.86);
              resolve(compressed);
            } else {
              resolve(rawDataUrl);
            }
          } catch {
            resolve(rawDataUrl);
          }
        };
        img.onerror = () => resolve(rawDataUrl);
        img.src = rawDataUrl;
      };
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(file);
    });
  };

  const handleUploadCustomAvatarFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0];
    if (!file.type.startsWith('image/') && !/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name)) {
      addNotification({
        title: '⚠️ Invalid Image Format',
        message: 'অনুগ্রহ করে একটি ছবি (JPG, PNG, WEBP, GIF) সিলেক্ট করুন।',
        type: 'system'
      });
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const optimizedDataUrl = await compressImageFileToDataUrl(file);
      setAvatar(optimizedDataUrl);
      setCustomAvatarUrl('');
      updateUserProfile({ avatar: optimizedDataUrl });

      // If Google Drive folder is linked in Sidebar, also back up the profile photo to Google Drive silently
      if (driveStorageSettings?.folderUrl || driveStorageSettings?.appsScriptWebAppUrl) {
        fetch('/api/drive-storage/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: `profile-avatar-${(name || 'user').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.jpg`,
            mimeType: 'image/jpeg',
            size: optimizedDataUrl.length,
            contentBase64: optimizedDataUrl,
            folderUrl: driveStorageSettings.folderUrl,
            folderId: driveStorageSettings.folderId,
            appsScriptWebAppUrl: driveStorageSettings.appsScriptWebAppUrl,
            source: 'profile_avatar'
          })
        }).catch(() => {});
      }

      confetti({ particleCount: 35, spread: 55, origin: { y: 0.35 } });
      addNotification({
        title: '📸 Profile Picture Uploaded!',
        message: 'আপনার প্রোফাইল ছবি সফলভাবে আপডেট ও সেভ হয়েছে।',
        type: 'system'
      });
    } catch {
      addNotification({
        title: '⚠️ Upload Failed',
        message: 'ছবিটি লোড করা যায়নি, আবার চেষ্টা করুন।',
        type: 'system'
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  if (!isOpen) return null;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    // If on security tab, validate password update
    if (activeSubTab === 'security' && (newPassword || currentPassword)) {
      if (newPassword !== confirmPassword) {
        setPassError('New passwords do not match!');
        return;
      }
      if (newPassword.length < 6) {
        setPassError('Password must be at least 6 characters long.');
        return;
      }
      const res = changeUserPassword(currentPassword, newPassword);
      if (!res.success) {
        setPassError(res.message);
        return;
      }
      setPassSuccess('Password updated successfully!');
    }

    const finalAvatar = customAvatarUrl.trim() || avatar;

    updateUserProfile({
      name: name.trim() || currentUser.name,
      company: company.trim() || currentUser.company,
      phone: phone.trim() || currentUser.phone,
      title: bio.split('|')[0]?.trim() || currentUser.title,
      avatar: finalAvatar
    });

    confetti({ particleCount: 50, spread: 60, origin: { y: 0.3 } });
    addNotification({
      title: 'Profile Updated 👤',
      message: `Account details for ${name} saved successfully.`,
      type: 'system'
    });
    onClose();
  };

  const handleLogout = () => {
    onClose();
    requestLogout();
  };

  const initials = name
    ? name
        .split(' ')
        .map(n => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'VS';

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#090d16] rounded-3xl shadow-2xl border border-slate-800 max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto text-slate-100">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-gradient-to-r from-blue-950/40 via-slate-900 to-cyan-950/40">
          <div className="flex items-center gap-3">
            <div
              onClick={() => {
                setActiveSubTab('avatar');
                setTimeout(() => avatarFileInputRef.current?.click(), 80);
              }}
              title="Click to upload your own profile photo"
              className="relative group cursor-pointer"
            >
              {avatar ? (
                <img 
                  src={avatar} 
                  alt={name} 
                  className="w-11 h-11 rounded-2xl object-cover ring-2 ring-cyan-500/50 shadow-md group-hover:opacity-80 transition"
                />
              ) : (
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-indigo-600 text-black flex items-center justify-center font-black text-sm shadow-md">
                  {initials}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 p-1 bg-cyan-500 text-slate-950 rounded-full text-[9px] font-black leading-none shadow flex items-center justify-center">
                <Camera className="w-3 h-3" />
              </span>
            </div>
            <div>
              <h3 className="font-black text-slate-100 text-base leading-tight">My Profile &amp; Account Settings</h3>
              <p className="text-[11px] text-slate-400 font-medium">Manage your personal info, custom profile photo, and security</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-800 bg-slate-950/60">
          <button 
            type="button" 
            onClick={() => setActiveSubTab('profile')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'profile'
                ? 'border-cyan-400 text-cyan-300 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile Details</span>
          </button>

          <button 
            type="button" 
            onClick={() => setActiveSubTab('avatar')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'avatar'
                ? 'border-cyan-400 text-cyan-300 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Profile Photo / Avatar</span>
          </button>

          <button 
            type="button" 
            onClick={() => setActiveSubTab('security')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'security'
                ? 'border-cyan-400 text-cyan-300 font-black'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password &amp; Security</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSaveProfile} className="p-6 space-y-4 max-h-[65vh] overflow-y-auto text-xs bg-[#090d16]">
          
          {/* TAB 1: Profile Details */}
          {activeSubTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Login Email Address (Primary Identity)
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={currentUser.email}
                    className="w-full pl-9 pr-3 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-400 font-mono text-xs cursor-not-allowed"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Email is locked to your authenticated session. Contact Owner to migrate mailbox.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Full Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rafiqul Islam"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Company / Agency Name
                  </label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      placeholder="e.g. Visual Sky Media"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Direct Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (415) 890-4211"
                      className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Outreach Timezone
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition"
                >
                  <option value="Asia/Dhaka (BST)">Asia/Dhaka (BST +06:00)</option>
                  <option value="Asia/Kolkata (IST)">Asia/Kolkata (IST +05:30)</option>
                  <option value="Asia/Dubai (GST)">Asia/Dubai (GST +04:00)</option>
                  <option value="Europe/London (GMT)">Europe/London (GMT +00:00)</option>
                  <option value="America/New_York (EST)">America/New_York (EST -05:00)</option>
                  <option value="America/Chicago (CST)">America/Chicago (CST -06:00)</option>
                  <option value="America/Los_Angeles (PST)">America/Los_Angeles (PST -08:00)</option>
                  <option value="UTC">UTC Standard (+00:00)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Short Bio / Sender Signature Note
                </label>
                <textarea
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Founder &amp; CEO | Scaling high-converting B2B outreach"
                  className="w-full p-3 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition resize-none font-sans"
                />
              </div>

              {/* Role, Plan & Payment Summary Box */}
              <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                    <span className="font-bold text-slate-200 capitalize">
                      {currentUser.role === 'agency' || currentUser.role === 'owner' || currentUser.isOwner 
                        ? 'Agency Master Account (role: agency)' 
                        : 'Client Customer Account (role: client)'}
                    </span>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    currentUser.role === 'agency' || currentUser.role === 'owner' || currentUser.isOwner
                      ? 'bg-amber-400 text-slate-950'
                      : 'bg-cyan-500 text-slate-950'
                  }`}>
                    {currentUser.bdtPlanLabel || (currentUser.role === 'agency' ? 'Agency Master (Free Unlimited)' : `${currentUser.plan} Plan`)}
                  </span>
                </div>

                {currentUser.paymentInfo && (
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Payment Gateway:</span>
                      <span className="font-bold text-cyan-400">{currentUser.paymentInfo.method}</span>
                      <span className="text-slate-500 font-mono">({currentUser.paymentInfo.senderPhone})</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">TrxID:</span>
                      <span className="font-mono font-bold text-amber-300">{currentUser.paymentInfo.trxId}</span>
                      <span className="font-black text-emerald-400">BDT {Number(currentUser.paymentInfo.amountBDT || 0).toLocaleString()}</span>
                    </div>
                  </div>
                )}

                {(currentUser.role === 'agency' || currentUser.role === 'owner' || currentUser.isOwner) && (
                  <div className="text-[10px] text-amber-400/90 pt-1 flex items-center gap-1.5">
                    <span>👑</span>
                    <span>100% Free Lifetime Agency Access &bull; Maximum 3 Seats Quota</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Profile Photo / Avatar */}
          {activeSubTab === 'avatar' && (
            <div className="space-y-4">
              <input
                ref={avatarFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleUploadCustomAvatarFile(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* Live Avatar Preview & Quick Action Bar */}
              <div className="p-4 bg-slate-900/80 rounded-2xl border border-cyan-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <img
                    src={customAvatarUrl.trim() || avatar}
                    alt="Preview"
                    className="w-16 h-16 rounded-2xl object-cover ring-2 ring-cyan-400 shadow-lg shrink-0"
                  />
                  <div>
                    <div className="font-black text-slate-100 text-sm">Current Profile Picture</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      আপনার নিজের ছবি আপলোড করুন (Drag &amp; Drop অথবা ফোল্ডার থেকে সিলেক্ট করুন)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => avatarFileInputRef.current?.click()}
                    disabled={isUploadingAvatar}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer transition shadow-md"
                  >
                    {isUploadingAvatar ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{isUploadingAvatar ? 'Uploading...' : 'Upload My Photo'}</span>
                  </button>
                  {avatar !== PRESET_AVATARS[0] && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatar(PRESET_AVATARS[0]);
                        setCustomAvatarUrl('');
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-300 border border-slate-700 cursor-pointer transition"
                      title="Reset to default avatar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Drag & Drop + Click to Browse Custom Picture Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingAvatar(true);
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingAvatar(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingAvatar(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingAvatar(false);
                  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                    handleUploadCustomAvatarFile(e.dataTransfer.files);
                  }
                }}
                onClick={() => avatarFileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-5 text-center space-y-2 cursor-pointer transition ${
                  isDraggingAvatar
                    ? 'border-cyan-400 bg-cyan-500/15 scale-[1.01]'
                    : 'border-cyan-500/40 hover:border-cyan-400 bg-slate-950/70 hover:bg-slate-900/80'
                }`}
              >
                <div className="w-11 h-11 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-xs sm:text-sm font-black text-white">
                  {isDraggingAvatar
                    ? '📂 এখানে আপনার ছবি ছেড়ে দিন (Drop Image Here)...'
                    : '📸 আপনার নিজের ছবি এখানে Drag & Drop করুন অথবা ক্লিক করে ফোল্ডার থেকে সিলেক্ট করুন'}
                </div>
                <p className="text-[11px] text-slate-400">
                  Supports JPG, PNG, WEBP, GIF • Auto-optimized so page load stays 100% fast
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-2">
                  Or Choose from Preset Avatars
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setAvatar(url);
                        setCustomAvatarUrl('');
                      }}
                      className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition-all cursor-pointer group ${
                        avatar === url && !customAvatarUrl
                          ? 'border-cyan-400 ring-4 ring-cyan-500/20 scale-95'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                      {avatar === url && !customAvatarUrl && (
                        <div className="absolute inset-0 bg-cyan-950/60 flex items-center justify-center">
                          <Check className="w-5 h-5 text-cyan-300 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Or Paste Custom Avatar Image URL
                </label>
                <input
                  type="url"
                  value={customAvatarUrl}
                  onChange={(e) => setCustomAvatarUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or company logo URL"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition"
                />
              </div>
            </div>
          )}

          {/* TAB 3: Password & Security */}
          {activeSubTab === 'security' && (
            <div className="space-y-4">
              {passError && (
                <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{passError}</span>
                </div>
              )}

              {passSuccess && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>{passSuccess}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 pr-9 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  New Password (min 6 characters)
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter strong new password"
                    className="w-full px-3 py-2 pr-9 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className="w-full px-3 py-2 pr-9 bg-slate-900 border border-slate-800 focus:border-cyan-400 rounded-xl text-slate-100 text-xs focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-amber-950/40 border border-amber-500/30 rounded-xl text-amber-300 text-[11px]">
                💡 Tip: Never share your master password or app passwords. Keep 2FA enabled on Google Workspace.
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 bg-[#090d16]">
            <button 
              type="button" 
              onClick={handleLogout}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/40 border border-rose-500/30 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <div className="flex items-center gap-2">
              <button 
                type="button" 
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:bg-slate-800 border border-slate-800 cursor-pointer transition-colors"
              >
                Cancel
              </button>

              <button 
                type="submit" 
                className="px-5 py-2.5 rounded-xl text-xs font-black text-black bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-md shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Save Profile Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
