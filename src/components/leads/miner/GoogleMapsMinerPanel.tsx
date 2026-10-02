import React from 'react';
import { MapPin, Navigation, Star, Phone, Globe, ShieldCheck, Zap, RefreshCw, StopCircle } from 'lucide-react';
import { MAPS_CATEGORIES, QUICK_CITIES } from './MiningModes';

interface GoogleMapsMinerPanelProps {
  category: string;
  setCategory: (c: string) => void;
  city: string;
  setCity: (c: string) => void;
  radius: string;
  setRadius: (r: string) => void;
  minRating: string;
  setMinRating: (r: string) => void;
  batchSize: number;
  setBatchSize: (b: number) => void;
  requirePhone: boolean;
  setRequirePhone: (r: boolean) => void;
  isGenerating: boolean;
  progressPercent: number;
  progressStep: string;
  onStartMining: () => void;
  onStopMining: () => void;
}

export const GoogleMapsMinerPanel: React.FC<GoogleMapsMinerPanelProps> = ({
  category,
  setCategory,
  city,
  setCity,
  radius,
  setRadius,
  minRating,
  setMinRating,
  batchSize,
  setBatchSize,
  requirePhone,
  setRequirePhone,
  isGenerating,
  progressPercent,
  progressStep,
  onStartMining,
  onStopMining
}) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
              <span>Google Maps Local Business Miner</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                Live Geotag Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Extract verified local brick-and-mortar & commercial business places with direct mobile/office phones and websites.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/30 font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Google Places API Ready</span>
        </div>
      </div>

      {/* Category Pills Selection */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-300 block">Select Target Local Business Category:</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {MAPS_CATEGORIES.map((cat) => {
            const isSelected = category === cat.label;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.label)}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold transition cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 shadow-md'
                    : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">{cat.icon}</span>
                <span className="truncate">{cat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Geo & Search Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* City Input & Quick Pills */}
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span>Target City / Metro / Postal Code</span>
            <span className="text-[10px] text-slate-400">e.g. Austin, TX or Chicago</span>
          </label>
          <div className="relative">
            <Navigation className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Austin, Texas or Los Angeles, CA"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 font-medium"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_CITIES.slice(0, 5).map((qCity, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCity(qCity)}
                className="text-[10px] px-2 py-0.5 rounded-md bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 border border-slate-800 transition cursor-pointer"
              >
                {qCity}
              </button>
            ))}
          </div>
        </div>

        {/* Radius */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-300 block">Search Radius</label>
          <select
            value={radius}
            onChange={(e) => setRadius(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="5 miles">5 Miles Radius</option>
            <option value="10 miles">10 Miles Radius</option>
            <option value="25 miles">25 Miles Radius</option>
            <option value="50 miles">50 Miles Radius (Metro)</option>
          </select>
        </div>

        {/* Batch Size & Min Rating */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">Min Rating</label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value="4.5">★ 4.5+ Stars</option>
              <option value="4.0">★ 4.0+ Stars</option>
              <option value="3.5">★ 3.5+ Stars</option>
              <option value="all">Any Rating</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">Batch</label>
            <select
              value={batchSize}
              onChange={(e) => setBatchSize(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              <option value={10}>10 Places</option>
              <option value={15}>15 Places</option>
              <option value={25}>25 Places</option>
              <option value={50}>50 Places</option>
            </select>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={requirePhone}
            onChange={(e) => setRequirePhone(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
          />
          <span className="font-semibold text-emerald-300">Require Verified Direct & Office Phone Numbers</span>
        </label>
      </div>

      {/* Action Button & Progress */}
      <div className="pt-2">
        {isGenerating ? (
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled
              className="flex-1 py-3.5 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 font-extrabold text-sm flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Scanning Google Maps Geotags ({progressPercent}%)...</span>
            </button>
            <button
              type="button"
              onClick={onStopMining}
              className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-sm shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <StopCircle className="w-5 h-5" />
              <span>Stop</span>
            </button>
          </div>
        ) : (
          <button
            onClick={onStartMining}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-400 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Mine {batchSize} Verified Places from Google Maps ({city || 'Nationwide'})</span>
          </button>
        )}
      </div>

      {isGenerating && (
        <div className="p-4 bg-slate-950/80 rounded-2xl border border-emerald-500/30 space-y-2">
          <div className="flex justify-between items-center text-xs text-emerald-300 font-bold">
            <span className="truncate max-w-[70%]">{progressStep}</span>
            <span className="font-mono">{progressPercent}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
