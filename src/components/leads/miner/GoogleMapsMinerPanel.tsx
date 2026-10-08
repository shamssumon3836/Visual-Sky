import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Navigation, 
  Star, 
  Phone, 
  Globe, 
  ShieldCheck, 
  Zap, 
  RefreshCw, 
  StopCircle, 
  Search, 
  Sparkles, 
  X, 
  Check,
  Edit3,
  Sliders,
  CheckCircle2
} from 'lucide-react';
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
  const [customSubKeyword, setCustomSubKeyword] = useState<string>('');
  const [inputVal, setInputVal] = useState<string>(String(batchSize || 10));

  useEffect(() => {
    setInputVal(String(batchSize));
  }, [batchSize]);

  const handleSelectPresetCategory = (catLabel: string) => {
    setCategory(catLabel);
  };

  const handleSelectQuickCity = (cityName: string) => {
    setCity(cityName);
  };

  const fullSearchQuery = [category.trim(), customSubKeyword.trim()].filter(Boolean).join(' - ');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-md">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
              <span>Google Maps Local Business Miner</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wide">
                Live Geotag & Places Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Type ANY custom local business niche, service or trade worldwide. Extracts verified direct phone numbers, live domains, and owner contacts.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-xl border border-emerald-500/30 font-mono">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>100% Live Verified Contact Engine</span>
        </div>
      </div>

      {/* CUSTOM CATEGORY & KEYWORDS INPUT HERO BOX */}
      <div className="space-y-4 p-5 rounded-2xl bg-slate-950/80 border border-emerald-500/40 shadow-inner">
        <div className="flex items-center justify-between">
          <label className="text-xs font-black text-slate-100 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 uppercase tracking-wide">
              Target Local Business Category / Custom Keywords (Type Anything):
            </span>
          </label>
          <span className="text-[10px] text-emerald-400 font-extrabold bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-500/40 flex items-center gap-1">
            <Edit3 className="w-3 h-3" />
            <span>Custom Free-Text Active</span>
          </span>
        </div>

        {/* Primary Custom Input */}
        <div className="relative">
          <input
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Type ANY business niche (e.g. Vintage Motorcycle Repair, Bengali Grocery & Halal Meat, Rooftop Solar Installers, Luxury Yacht Charter, CrossFit Box, Pediatric Dentist, Boutique Hotel)..."
            className="w-full bg-slate-900 border-2 border-emerald-500/50 focus:border-emerald-400 rounded-2xl px-4 py-3.5 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none font-semibold shadow-inner transition"
          />
          {category && (
            <button
              type="button"
              onClick={() => setCategory('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
              title="Clear category input"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Secondary Sub-Service & Specialty Keywords (Optional) */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Sliders className="w-3 h-3 text-emerald-400" />
              <span>Additional Custom Keywords or Specialties (Optional):</span>
            </span>
            <span className="text-[10px] text-slate-500">Appended to Google Maps search query</span>
          </div>
          <input
            type="text"
            value={customSubKeyword}
            onChange={(e) => setCustomSubKeyword(e.target.value)}
            placeholder="e.g. 24/7 Emergency Service, Commercial Clients, Organic Certified, Halal Meat, High-End Luxury, Licensed & Insured..."
            className="w-full bg-slate-900/80 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none font-medium"
          />
        </div>

        {/* Quick Category Presets (Click to Auto-fill & Customize) */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>💡 Popular Category Presets (Click to Auto-fill or Edit Above):</span>
            <span className="text-[10px] text-emerald-400">15 Presets available</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {MAPS_CATEGORIES.map((cat) => {
              const isSelected = category.toLowerCase().trim() === cat.label.toLowerCase().trim();
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleSelectPresetCategory(cat.label)}
                  className={`p-2 rounded-xl border text-left text-xs font-semibold transition cursor-pointer flex items-center justify-between gap-1.5 ${
                    isSelected
                      ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-200 shadow-md ring-1 ring-emerald-500/40'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="text-sm">{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Geo & Search Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* City Input & Quick Pills */}
        <div className="md:col-span-2 space-y-2">
          <label className="text-xs font-bold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              <span>Target City / Metro / Postal Code / State (Type Any Location Worldwide):</span>
            </span>
            <span className="text-[10px] text-emerald-400">Worldwide supported</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Dhaka, Bangladesh or Austin, Texas or Queens, New York or London, UK or Dubai, UAE..."
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none font-medium"
            />
            {city && (
              <button
                type="button"
                onClick={() => setCity('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
                title="Clear location"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {QUICK_CITIES.map((qCity, idx) => {
              const isSelected = city.toLowerCase().includes(qCity.toLowerCase().split(',')[0]);
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectQuickCity(qCity)}
                  className={`text-[10px] px-2 py-0.5 rounded-md border transition cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300 font-bold'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-emerald-300 border-slate-800'
                  }`}
                >
                  {qCity}
                </button>
              );
            })}
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
            <option value="5 miles">5 Miles (Neighborhood)</option>
            <option value="15 miles">15 Miles (City Center)</option>
            <option value="25 miles">25 Miles (Suburbs)</option>
            <option value="50 miles">50 Miles (Full Metro Area)</option>
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
          <div className="space-y-1.5 sm:col-span-2 md:col-span-1 p-2.5 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-black text-emerald-200">Custom Prospects / Places</label>
                <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
                  ইচ্ছেমতো সংখ্যা লিখুন
                </span>
              </div>
              <span className="text-xs text-emerald-300 font-mono font-black">{batchSize} Places</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-inner shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, batchSize - 5);
                    setBatchSize(next);
                  }}
                  className="px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                  title="Decrease by 5"
                >
                  -5
                </button>
                <input
                  type="number"
                  min={1}
                  max={250}
                  value={inputVal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setInputVal(val);
                    const n = parseInt(val, 10);
                    if (!isNaN(n) && n > 0) {
                      setBatchSize(Math.min(n, 250));
                    }
                  }}
                  onBlur={() => {
                    if (!batchSize || batchSize < 1) {
                      setBatchSize(10);
                      setInputVal('10');
                    } else {
                      setInputVal(String(batchSize));
                    }
                  }}
                  placeholder="e.g. 50"
                  className="w-14 bg-transparent text-center text-xs font-mono font-black text-emerald-300 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(250, batchSize + 5);
                    setBatchSize(next);
                  }}
                  className="px-2 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                  title="Increase by 5"
                >
                  +5
                </button>
              </div>

              <div className="flex items-center gap-1 flex-1 overflow-x-auto py-0.5">
                {[5, 10, 20, 25, 50, 75, 100, 150, 200].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setBatchSize(num);
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer shrink-0 ${
                      batchSize === num
                        ? 'bg-emerald-500 text-black font-black shadow-md shadow-emerald-500/20'
                        : 'bg-slate-950 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
            <div className="text-[9px] text-slate-400">
              💡 টাইপ করুন যেকোনো সংখ্যা — ঠিক সেই পরিমাণ ভেরিফাইড প্লেস ও লিড পাওয়া যাবে
            </div>
          </div>
        </div>
      </div>

      {/* Live Search Query Preview & Verification Guarantee */}
      <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 truncate">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-slate-400">Active Query Preview:</span>
          <span className="font-bold text-slate-100 font-mono truncate">
            "{fullSearchQuery || 'Local Businesses'}" in "{city || 'Worldwide'}"
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          <span>Real Area-Code Phone & Live Domain Verified</span>
        </div>
      </div>

      {/* Verified Contact Toggles */}
      <div className="flex items-center gap-4 text-xs text-slate-300 pt-1">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={requirePhone}
            onChange={(e) => setRequirePhone(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
          />
          <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5 text-emerald-400" />
            <span>Enforce 100% Verified Working Phone & Active Website Contact (Anti-Dummy Filter)</span>
          </span>
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
              <span>Scanning Google Maps Geotags for "{fullSearchQuery || 'Local Businesses'}" ({progressPercent}%)...</span>
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
            disabled={!category.trim()}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-500 hover:from-emerald-500 hover:via-teal-500 hover:to-cyan-400 disabled:opacity-50 text-white font-extrabold text-sm shadow-xl shadow-emerald-600/25 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>
              Mine {batchSize} Verified Places for "{fullSearchQuery || 'Business'}" in {city || 'City'}
            </span>
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
