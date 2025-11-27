import React, { useState, useRef, useEffect } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter
} from 'recharts';
import { DataPoint, OLSResult, SimulationParams } from '../types';

interface MainPlotProps {
  data: DataPoint[];
  ols: OLSResult;
  params: SimulationParams;
}

export const MainPlot: React.FC<MainPlotProps> = ({ data, ols, params }) => {
  // Limit the number of visible points for performance
  const MAX_VISIBLE_POINTS = 500;
  const visibleData = data.slice(-MAX_VISIBLE_POINTS);
  const isTruncated = data.length > MAX_VISIBLE_POINTS;

  // Generate line data points for visualization
  const minX = 0;
  const maxX = 10;
  
  const lineData = [
    { 
      x: minX, 
      trueY: params.trueIntercept + params.trueSlope * minX,
      estY: ols.intercept + ols.slope * minX
    },
    { 
      x: maxX, 
      trueY: params.trueIntercept + params.trueSlope * maxX,
      estY: ols.intercept + ols.slope * maxX
    }
  ];

  // --- Draggable Overlay Logic ---
  const [isDragging, setIsDragging] = useState(false);
  // Initial position -1 indicates "use default CSS positioning"
  const [position, setPosition] = useState<{x: number, y: number}>({ x: -1, y: -1 });
  const dragOffset = useRef<{x: number, y: number}>({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      // Calculate offset relative to the element's top-left
      dragOffset.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      
      // If this is the first drag, we need to switch from CSS positioning to absolute coordinates
      if (position.x === -1) {
        // We need the parent container's rect to calculate relative position
        const parent = overlayRef.current.offsetParent as HTMLElement;
        if (parent) {
           const parentRect = parent.getBoundingClientRect();
           // Set initial specific coordinates based on where it currently is visually
           setPosition({
             x: rect.left - parentRect.left,
             y: rect.top - parentRect.top
           });
        }
      }
      
      setIsDragging(true);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !overlayRef.current) return;
      
      const parent = overlayRef.current.offsetParent as HTMLElement;
      if (!parent) return;
      
      const parentRect = parent.getBoundingClientRect();
      
      // Calculate new position relative to parent
      let newX = e.clientX - parentRect.left - dragOffset.current.x;
      let newY = e.clientY - parentRect.top - dragOffset.current.y;

      // Constrain to parent bounds (optional, but good UX)
      const maxX = parentRect.width - overlayRef.current.offsetWidth;
      const maxY = parentRect.height - overlayRef.current.offsetHeight;

      newX = Math.max(0, Math.min(newX, maxX));
      newY = Math.max(0, Math.min(newY, maxY));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);


  // Determine styles for the overlay
  const overlayStyle: React.CSSProperties = position.x !== -1 
    ? { left: position.x, top: position.y } 
    : {}; 

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-100 h-[400px] flex flex-col relative">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-slate-800">Population vs. Sample Regression Model</h3>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2" title={isTruncated ? `Displaying only the most recent ${MAX_VISIBLE_POINTS} points for performance` : 'Displaying all points'}>
            <span className="w-3 h-3 rounded-full bg-slate-300"></span>
            <span className="text-slate-500 font-medium">
              {isTruncated ? `Data Points (Last ${MAX_VISIBLE_POINTS})` : 'Data Points'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 bg-emerald-500"></span>
            <span className="text-emerald-700 font-medium">True Population</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-6 h-0.5 bg-indigo-600 border-t-2 border-dashed border-indigo-600"></span>
            <span className="text-indigo-700 font-medium">OLS Estimate</span>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full relative overflow-hidden">
        {/* Draggable Sample Size Overlay */}
        <div 
          ref={overlayRef}
          onMouseDown={handleMouseDown}
          style={overlayStyle}
          className={`absolute z-20 cursor-move select-none transition-shadow ${
            position.x === -1 ? 'top-4 right-6' : '' 
          } ${isDragging ? 'scale-105 shadow-lg' : 'shadow-sm'}`}
        >
           <div className="bg-white/95 backdrop-blur-md border border-slate-200 px-5 py-3 rounded-lg flex flex-col items-end hover:border-indigo-300 transition-colors">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Sample Size</span>
              <span className="text-4xl font-black text-slate-800 font-mono leading-none">
                n = {data.length}
              </span>
              <div className="text-[10px] text-slate-400 mt-1 font-medium flex items-center gap-1">
                 Drag to move
              </div>
           </div>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart margin={{ top: 20, right: 30, bottom: 50, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="x" 
              type="number" 
              domain={[0, 10]} 
              ticks={[0, 2, 4, 6, 8, 10]}
              label={{ 
                value: 'Independent Variable (X)', 
                position: 'bottom', 
                offset: 0,
                style: { textAnchor: 'middle', fill: '#64748b', fontSize: '12px', fontWeight: 500 }
              }} 
              allowDataOverflow={false}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <YAxis 
              dataKey="y" 
              type="number" 
              domain={['auto', 'auto']}
              label={{ 
                value: 'Dependent Variable (Y)', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#64748b', fontSize: '12px', fontWeight: 500 } 
              }}
              tick={{ fontSize: 12, fill: '#64748b' }}
            />
            <Tooltip 
              cursor={{ strokeDasharray: '3 3' }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const d = payload[0].payload;
                  return (
                    <div className="bg-white p-2 border border-slate-200 shadow-md rounded text-xs z-30 relative">
                      <p>x: {Number(d.x).toFixed(2)}</p>
                      <p>y: {Number(d.y).toFixed(2)}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            
            <Scatter 
              data={visibleData} 
              fill="#94a3b8" 
              fillOpacity={0.4} 
              isAnimationActive={false} 
              radius={3}
            />
            
            <Line
              data={lineData}
              type="monotone"
              dataKey="trueY"
              stroke="#10b981"
              strokeWidth={3}
              dot={false}
              isAnimationActive={false}
              activeDot={false}
              name="True Line"
            />
             <Line
              data={lineData}
              type="monotone"
              dataKey="estY"
              stroke="#4f46e5"
              strokeWidth={4}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
              activeDot={false}
              name="OLS Estimate"
            />

          </ComposedChart>
        </ResponsiveContainer>
        
        {data.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/50 backdrop-blur-sm z-10">
            <p className="text-slate-400 font-medium">Press Start to generate data...</p>
          </div>
        )}
      </div>
    </div>
  );
};
