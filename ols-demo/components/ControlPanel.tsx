import React from 'react';
import { Play, Pause, RotateCcw, Settings2, Database, Video, Square, Hash, Clock, Sigma, TrendingUp, MoveVertical } from 'lucide-react';
import { SimulationParams } from '../types';

interface ControlPanelProps {
  params: SimulationParams;
  setParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  isRunning: boolean;
  setIsRunning: (val: boolean) => void;
  reset: () => void;
  count: number;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  params,
  setParams,
  isRunning,
  setIsRunning,
  reset,
  count,
  isRecording,
  onStartRecording,
  onStopRecording
}) => {
  const handleChange = (key: keyof SimulationParams, value: number | string) => {
    setParams(prev => ({ ...prev, [key]: value }));
  };

  const InputRow = ({ label, value, onChange, step = 1, min, max, icon: Icon }: any) => (
    <div className="flex items-center justify-between group py-1">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
        {Icon && <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 transition-colors" />}
        <span>{label}</span>
      </label>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-20 px-2 py-1 text-sm border border-slate-200 rounded-md text-right font-mono focus:ring-2 focus:ring-indigo-500 outline-none hover:border-slate-300 transition-all bg-slate-50 focus:bg-white"
      />
    </div>
  );

  return (
    <div className="bg-white p-5 rounded-xl shadow-lg border border-slate-100 flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
        <Settings2 className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-slate-800">Parameters</h2>
      </div>

      <div className="space-y-6">
        {/* Statistical Parameters */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Model Config</div>
          <InputRow 
            label="True Slope (β₁)" 
            value={params.trueSlope} 
            onChange={(val: number) => handleChange('trueSlope', val)} 
            step={0.1}
            icon={TrendingUp}
          />
          <InputRow 
            label="True Intercept (β₀)" 
            value={params.trueIntercept} 
            onChange={(val: number) => handleChange('trueIntercept', val)} 
            step={0.1}
            icon={MoveVertical}
          />
          <InputRow 
            label="Noise Level (σ)" 
            value={params.noiseLevel} 
            onChange={(val: number) => handleChange('noiseLevel', val)} 
            step={0.1} 
            min={0.1}
            icon={Sigma}
          />
        </div>

        {/* Simulation Settings */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Simulation</div>
           <InputRow 
            label="Start Size (N)" 
            value={params.minSampleSize} 
            onChange={(val: number) => handleChange('minSampleSize', val)} 
            min={3}
            icon={Database}
          />
          <InputRow 
            label="Max Size (N)" 
            value={params.maxSampleSize} 
            onChange={(val: number) => handleChange('maxSampleSize', val)} 
            step={500}
            icon={Database}
          />
           <InputRow 
            label="Random Seed" 
            value={params.seed} 
            onChange={(val: number) => handleChange('seed', val)} 
            min={1}
            icon={Hash}
          />
           <InputRow 
            label="Speed (ms)" 
            value={params.speed} 
            onChange={(val: number) => handleChange('speed', val)} 
            min={10}
            step={10}
            icon={Clock}
          />
        </div>

        {/* Sampling Mode */}
        <div>
           <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Sampling</div>
           <div className="flex bg-slate-100 p-1 rounded-lg">
             <button
               onClick={() => handleChange('samplingMode', 'cumulative')}
               className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                 params.samplingMode === 'cumulative'
                   ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                   : 'text-slate-500 hover:text-slate-700'
               }`}
             >
               Cumulative
             </button>
             <button
               onClick={() => handleChange('samplingMode', 'independent')}
               className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${
                 params.samplingMode === 'independent'
                   ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                   : 'text-slate-500 hover:text-slate-700'
               }`}
             >
               Resample
             </button>
           </div>
        </div>
      </div>

      <div className="mt-auto pt-6 space-y-3">
        <div className="flex gap-2">
          <button
            onClick={() => setIsRunning(!isRunning)}
            disabled={count >= params.maxSampleSize || isRecording}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold text-white transition-all shadow-sm ${
              count >= params.maxSampleSize || isRecording
                ? 'bg-slate-300 cursor-not-allowed'
                : isRunning 
                  ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-4 h-4" /> Pause
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> {count >= params.maxSampleSize ? 'Finished' : 'Start'}
              </>
            )}
          </button>
          
          <button
            onClick={reset}
            disabled={isRecording}
            className={`px-3 py-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors font-medium ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
            title="Reset Simulation"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

         {/* Record Button */}
         <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            className={`w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium text-sm transition-all border ${
              isRecording 
                ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 animate-pulse' 
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 fill-current" /> Stop Recording
              </>
            ) : (
              <>
                <Video className="w-4 h-4" /> Record Session
              </>
            )}
          </button>
        
        <div className="text-center p-2 bg-slate-50 rounded-lg border border-slate-100 mt-2">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide font-bold">Sample Size</span>
          <div className="text-xl font-bold text-slate-800 font-mono leading-tight">
            {count} <span className="text-xs text-slate-400 font-normal">/ {params.maxSampleSize}</span>
          </div>
        </div>
      </div>
    </div>
  );
};