import React from 'react';
import { LogOut, AlertTriangle, X } from 'lucide-react';
import { UserAccount } from '../../types';

interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  currentUser: UserAccount;
}

export const LogoutConfirmModal: React.FC<LogoutConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  currentUser
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="bg-[#0b111e] border border-slate-800 rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl shadow-rose-950/20 text-slate-100 relative animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-3.5 top-3.5 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4 pr-6">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0 shadow-lg shadow-rose-500/10">
            <LogOut className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 truncate">
              <span className="truncate">Confirm Logout</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold uppercase tracking-wider shrink-0">
                Sign Out
              </span>
            </h3>
            <p className="text-xs text-slate-400 truncate">
              End your active session securely
            </p>
          </div>
        </div>

        {/* Current Active Account Card */}
        <div className="p-2.5 sm:p-3 bg-slate-900/90 border border-slate-800 rounded-xl mb-3.5 flex items-center gap-2.5 sm:gap-3">
          <img 
            src={currentUser.avatar} 
            alt={currentUser.name} 
            className="w-9 h-9 rounded-lg object-cover ring-1 ring-cyan-500/40 shrink-0" 
          />
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</div>
            <div className="text-[11px] text-slate-400 truncate">{currentUser.email || 'No registered email'}</div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-slate-800 text-cyan-300 border border-slate-700 shrink-0 whitespace-nowrap">
            {currentUser.role}
          </span>
        </div>

        {/* Warning / Explanation Text */}
        <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl mb-4 text-xs text-slate-300 space-y-1">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Sign-in required to regain access</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Logging out will safely end your session. You can sign back in with your credentials at any time.
          </p>
        </div>

        {/* Action Buttons: Yes / No - responsive, whitespace-nowrap, no breaking */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition cursor-pointer flex items-center justify-center text-center whitespace-nowrap"
          >
            Stay Signed In
          </button>
          
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 text-white text-xs font-bold shadow-lg shadow-rose-600/30 transition cursor-pointer flex items-center justify-center gap-1.5 text-center whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Yes, Log Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
