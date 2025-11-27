import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { HistoryPoint } from '../types';

interface ConvergencePlotProps {
  history: HistoryPoint[];
  trueValue: number;
  dataKey: keyof HistoryPoint;
  title: string;
  color: string;
}

export const ConvergencePlot: React.FC<ConvergencePlotProps> = ({ 
  history, 
  trueValue, 
  dataKey, 
  title,
  color 
}) => {
  // Downsample for performance if history is huge
  const displayHistory = useMemo(() => {
     return history.length > 500 
      ? history.filter((_, i) => i % Math.ceil(history.length / 500) === 0 || i === history.length - 1)
      : history;
  }, [history]);

  const currentValue = history.length > 0 ? history[history.length - 1][dataKey] : 0;

  // State for the Y-axis domain to control update frequency
  const [chartDomain, setChartDomain] = useState<[number, number]>(['auto', 'auto'] as any);
  const lastUpdateN = useRef<number>(0);

  useEffect(() => {
    if (history.length === 0) return;

    const currentN = history[history.length - 1].n;
    
    // Update Logic:
    // 1. Always update at the start (n < 50) for smooth animation.
    // 2. Afterwards, only update every ~10 samples to reduce jitter.
    if (currentN < 50 || (currentN - lastUpdateN.current >= 10)) {
      
      // Filter out the first 10 points for scale calculation to avoid initial extreme outliers 
      // blowing up the scale, unless we only have few points.
      // We start considering "convergence" after n=10.
      const validHistory = history.filter(h => h.n > 10);
      const dataToConsider = validHistory.length > 0 ? validHistory : history;
      
      const values = dataToConsider.map(h => Number(h[dataKey]));
      let min = Math.min(...values);
      let max = Math.max(...values);
      
      // Requirement: Must include the True Value (beta or 0 for SE)
      min = Math.min(min, trueValue);
      max = Math.max(max, trueValue);
      
      // Requirement: Range should be 110% of the max/min (5% padding on each side)
      const range = max - min;
      // If range is 0 (flat line), add a small default padding
      const padding = range === 0 ? (Math.abs(trueValue) * 0.1 || 0.1) : range * 0.05;
      
      setChartDomain([min - padding, max + padding]);
      lastUpdateN.current = currentN;
    }
  }, [history, dataKey, trueValue]);

  // Smart number formatter for axis ticks
  const formatTickY = (val: number) => {
    if (val === 0) return "0";
    
    const domainSpan = chartDomain[1] - chartDomain[0];
    
    // If range is tiny, use scientific or high precision
    if (domainSpan < 0.001) {
       return val.toExponential(2);
    }

    if (Math.abs(val) >= 10000 || Math.abs(val) < 0.001) {
      return val.toExponential(1);
    }
    return val.toLocaleString(undefined, { maximumFractionDigits: 3 });
  };

  const formatTickX = (val: number) => {
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toString();
  };

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-slate-100 flex flex-col h-64 overflow-hidden relative group">
      <div className="flex justify-between items-start mb-2 shrink-0 px-1">
        <div>
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{title}</h4>
          <div className="flex items-baseline gap-2 mt-0.5">
             <span className="text-xl font-bold text-slate-800 font-mono">
              {Number(currentValue).toFixed(3)}
            </span>
             <span className="text-[10px] text-slate-400 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
              Target: {trueValue}
            </span>
          </div>
        </div>
        <div className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
          Math.abs(Number(currentValue) - trueValue) < 0.1 
            ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
            : 'bg-amber-50 text-amber-600 border-amber-100'
        }`}>
          Err: {Math.abs(Number(currentValue) - trueValue).toFixed(3)}
        </div>
      </div>

      <div className="flex-1 w-full relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayHistory} margin={{ top: 10, right: 10, bottom: 50, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis 
              dataKey="n" 
              type="number" 
              hide={false}
              domain={['dataMin', 'dataMax']}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickFormatter={formatTickX}
              interval="preserveStartEnd"
              label={{ 
                value: 'Sample Size (n)', 
                position: 'bottom',
                offset: 0,
                style: { textAnchor: 'middle', fill: '#64748b', fontSize: '10px', fontWeight: 600 }
              }}
            />
            <YAxis 
              domain={chartDomain} 
              type="number"
              orientation="right" 
              tick={{fontSize: 10, fill: '#94a3b8', fontWeight: 500}}
              tickFormatter={formatTickY}
              width={60} 
              interval="preserveStartEnd"
              allowDataOverflow={true}
              axisLine={false}
              tickLine={false}
              tickCount={6}
            />
            <Tooltip 
              labelFormatter={(label) => `n = ${label}`}
              formatter={(value: number) => [value.toFixed(5), title]}
              contentStyle={{ 
                borderRadius: '0.5rem', 
                border: '1px solid #e2e8f0', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                fontSize: '12px'
              }}
            />
            <ReferenceLine 
              y={trueValue} 
              stroke="#10b981" 
              strokeDasharray="3 3" 
              strokeOpacity={0.8}
            />
            <Line 
              type="monotone" 
              dataKey={dataKey} 
              stroke={color} 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};