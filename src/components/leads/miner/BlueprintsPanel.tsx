import React from 'react';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';
import { INDUSTRY_BLUEPRINTS, IndustryBlueprint } from './MiningModes';

interface BlueprintsPanelProps {
  onSelectBlueprint: (bp: IndustryBlueprint) => void;
}

export const BlueprintsPanel: React.FC<BlueprintsPanelProps> = ({ onSelectBlueprint }) => {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <h3 className="font-extrabold text-base text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <span>High-Converting Industry Blueprints</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide">
              1-Click Setup
            </span>
          </h3>
          <p className="text-xs text-slate-400">
            Curated high-converting targeting frameworks with optimal roles, directories, and social platforms pre-configured.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {INDUSTRY_BLUEPRINTS.map((bp) => (
          <div
            key={bp.id}
            onClick={() => onSelectBlueprint(bp)}
            className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/90 transition cursor-pointer flex flex-col justify-between group space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-2xl p-2 rounded-xl bg-slate-900 border border-slate-800">{bp.icon}</span>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-amber-300 group-hover:border-amber-500/30 transition">
                  {bp.badge}
                </span>
              </div>
              <h4 className="font-bold text-sm text-slate-100 group-hover:text-amber-200 transition">
                {bp.name}
              </h4>
              <p className="text-[11px] text-slate-400 line-clamp-2">
                {bp.description}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800/80 space-y-1.5 text-[10px] text-slate-400">
              <div className="flex items-center justify-between">
                <span>Role:</span>
                <span className="text-slate-200 font-semibold truncate max-w-[120px]">{bp.targetRole}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Sources:</span>
                <span className="text-amber-300 font-mono truncate max-w-[120px]">
                  {bp.selectedDirectories.slice(0, 2).join(' + ')}
                </span>
              </div>

              <div className="pt-2 flex items-center justify-end gap-1 text-amber-400 font-extrabold text-xs group-hover:translate-x-0.5 transition">
                <span>Load Blueprint</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
