import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ControlPanel } from './components/ControlPanel';
import { MainPlot } from './components/MainPlot';
import { ConvergencePlot } from './components/ConvergencePlot';
import { DataPoint, SimulationParams, OLSResult, HistoryPoint } from './types';
import { randomNormal, calculateOLS, seededRandom } from './utils/math';
import { TrendingUp, Activity, Info } from 'lucide-react';

const App: React.FC = () => {
  // State
  const [params, setParams] = useState<SimulationParams>({
    trueSlope: 1.5,
    trueIntercept: 2.0,
    noiseLevel: 2.0,
    batchSize: 1,
    speed: 50, // ms interval
    minSampleSize: 10,
    maxSampleSize: 2000,
    samplingMode: 'cumulative',
    seed: 42
  });

  const [isRunning, setIsRunning] = useState(false);
  const [data, setData] = useState<DataPoint[]>([]);
  const [ols, setOls] = useState<OLSResult>({ slope: 0, intercept: 0, rSquared: 0, slopeStdErr: 0 });
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Refs for animation loop
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);

  // Helper to generate points
  // Uses seededRandom for deterministic generation based on Point ID
  const generatePoints = useCallback((count: number, startId: number, currentParams: SimulationParams) => {
    const points: DataPoint[] = [];
    for (let i = 0; i < count; i++) {
      const id = startId + i;
      // We use the ID + Seed to determine X and Error. 
      // This ensures that point #5 is always point #5 regardless of when it's generated, 
      // provided the Seed is constant.
      
      // X is uniform [0, 10]
      const r1 = seededRandom(currentParams.seed, id * 100); 
      const x = r1 * 10;
      
      // Error is Normal(0, noise)
      // Pass id to randomNormal to ensure unique noise per point
      const error = randomNormal(0, currentParams.noiseLevel, currentParams.seed, id * 100 + 1);
      
      const y = currentParams.trueIntercept + (currentParams.trueSlope * x) + error;
      points.push({ id, x, y });
    }
    return points;
  }, []);

  // Update logic
  const updateSimulation = useCallback((currentData: DataPoint[]) => {
    // If we've reached the max, stop
    if (currentData.length >= params.maxSampleSize) {
      setIsRunning(false);
      return currentData;
    }

    const currentN = currentData.length;
    let nextN = Math.min(currentN + params.batchSize, params.maxSampleSize);
    
    let nextData: DataPoint[];

    if (params.samplingMode === 'cumulative') {
        const pointsToAdd = nextN - currentN;
        if (pointsToAdd <= 0) return currentData;
        const newPoints = generatePoints(pointsToAdd, currentN, params);
        nextData = [...currentData, ...newPoints];
    } else {
        // Independent Resampling Mode
        // We need to ensure that the set of IDs used in this frame is completely disjoint 
        // from the set of IDs used in the previous frame to simulate a "fresh" sample.
        // Previously we used `currentN + 10000`, which resulted in a sliding window (mostly same points).
        // Now we use `nextN * 100000`. Since maxSampleSize is 50,000, 
        // Frame 1 (N=10) starts at ID 1,000,000.
        // Frame 2 (N=11) starts at ID 1,100,000.
        // The gap is huge, ensuring no ID overlap.
        nextData = generatePoints(nextN, nextN * 100000, params);
    }

    const newOls = calculateOLS(nextData);
    setOls(newOls);

    setHistory(prevHist => [
      ...prevHist,
      {
        n: nextData.length,
        estimatedSlope: newOls.slope,
        estimatedIntercept: newOls.intercept,
        slopeStdErr: newOls.slopeStdErr
      }
    ]);

    return nextData;
  }, [params, generatePoints]);


  // Core Loop
  const animate = useCallback((time: number) => {
    if (time - lastTimeRef.current >= params.speed) {
      setData(prevData => updateSimulation(prevData));
      lastTimeRef.current = time;
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [params.speed, updateSimulation]);

  useEffect(() => {
    if (isRunning) {
      requestRef.current = requestAnimationFrame(animate);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isRunning, animate]);

  // Handle Reset and Initial Load
  const resetSimulation = useCallback(() => {
    setIsRunning(false);
    
    // Initialize with minSampleSize points
    const initialData = generatePoints(params.minSampleSize, 0, params);
    setData(initialData);
    
    const initialOls = calculateOLS(initialData);
    setOls(initialOls);
    
    setHistory([{
      n: initialData.length,
      estimatedSlope: initialOls.slope,
      estimatedIntercept: initialOls.intercept,
      slopeStdErr: initialOls.slopeStdErr
    }]);
  }, [params.minSampleSize, params.trueSlope, params.trueIntercept, params.noiseLevel, params.samplingMode, params.seed, generatePoints]);

  // Initial load
  useEffect(() => {
    if (data.length === 0) {
      resetSimulation();
    }
  }, []);

  // When Seed changes, we should reset immediately to show the new "world"
  useEffect(() => {
     if (data.length > 0) {
         resetSimulation();
     }
  }, [params.seed]);


  // --- Recording Logic ---

  const downloadVideo = () => {
    if (recordedChunksRef.current.length === 0) return;
    
    const blob = new Blob(recordedChunksRef.current, {
      type: 'video/webm'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    document.body.appendChild(a);
    a.style.display = 'none';
    a.href = url;
    a.download = `ols-simulation-${new Date().toISOString().slice(0,19)}.webm`;
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    recordedChunksRef.current = [];
  };

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      // Also stop all tracks to release the "sharing" indicator
      if (mediaRecorderRef.current.stream) {
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }
    }
    setIsRecording(false);
    setIsRunning(false); // Also pause simulation
  }, []);

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert("Screen recording is not supported in this browser.");
        return;
      }

      // Prompt user to select screen/tab
      // Use basic constraints (video: true) to avoid OverconstrainedError or type errors in some environments
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      });

      // Reset everything for a clean take
      resetSimulation();

      // Determine supported mime type
      let mimeType = 'video/webm; codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm'; // Fallback
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
         // Last resort fallback
         mimeType = '';
      }

      const options = mimeType ? { mimeType } : undefined;
      const recorder = new MediaRecorder(stream, options);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        downloadVideo();
        setIsRecording(false);
      };

      // Handle user clicking "Stop Sharing" in browser UI
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
               stopRecording();
          }
        };
      }

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      
      // Give a tiny delay before starting simulation so the video doesn't start abruptly
      setTimeout(() => setIsRunning(true), 1000);

    } catch (err) {
      console.error("Error starting recording:", err);
      alert("Could not start recording. See console for details.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-indigo-600 rounded-lg shadow-lg shadow-indigo-200 text-white">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">OLS Regression Simulator</h1>
            <p className="text-slate-500 text-sm font-medium">Visualizing statistical consistency and convergence</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Controls - Left Side on Desktop */}
          <div className="lg:col-span-3 lg:h-[calc(100vh-12rem)] sticky top-4">
             <ControlPanel 
                params={params}
                setParams={setParams}
                isRunning={isRunning}
                setIsRunning={setIsRunning}
                reset={resetSimulation}
                count={data.length}
                isRecording={isRecording}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
             />
             
             <div className="mt-4 bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex gap-3 text-xs text-indigo-800">
                <Info className="w-4 h-4 shrink-0 text-indigo-600" />
                <p>Increase sample size to observe convergence of estimates to true parameters.</p>
             </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-9 space-y-6">
            
            <MainPlot data={data} ols={ols} params={params} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ConvergencePlot 
                history={history}
                trueValue={params.trueSlope}
                dataKey="estimatedSlope"
                title="Slope Estimate (β₁)"
                color="#4f46e5"
              />
              <ConvergencePlot 
                history={history}
                trueValue={params.trueIntercept}
                dataKey="estimatedIntercept"
                title="Intercept Estimate (β₀)"
                color="#0ea5e9"
              />
            </div>
            
            {/* Stats Summary Bar */}
             <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-wrap gap-6 justify-around text-sm">
                <div className="flex flex-col items-center">
                   <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">R-Squared</span>
                   <span className="font-mono font-bold text-slate-700">{ols.rSquared.toFixed(4)}</span>
                </div>
                 <div className="flex flex-col items-center">
                   <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Slope Std Err</span>
                   <span className="font-mono font-bold text-slate-700">{ols.slopeStdErr.toFixed(4)}</span>
                </div>
                <div className="flex flex-col items-center">
                   <span className="text-slate-400 font-medium uppercase tracking-wider text-[10px]">Noise (σ)</span>
                   <span className="font-mono font-bold text-slate-700">{params.noiseLevel}</span>
                </div>
             </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
