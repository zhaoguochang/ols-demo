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
      console.error("Error starting screen recording:", err);
      // More friendly error message
      let message = "Could not start recording.";
      if (err instanceof DOMException) {
         if (err.name === 'NotAllowedError') {
             message = "Recording permission was denied or is blocked by the environment.";
         } else if (err.name === 'NotFoundError') {
             message = "No screen recording source was found.";
         } else if (err.name === 'NotReadableError') {
             message = "Could not access the screen. Please check system permissions.";
         }
      }
      alert(message);
    }
  };

  // Auto-stop recording when simulation finishes
  useEffect(() => {
    if (isRecording && data.length >= params.maxSampleSize) {
      // Small delay to capture the final state
      setTimeout(() => {
          stopRecording();
      }, 1000);
    }
  }, [data.length, params.maxSampleSize, isRecording, stopRecording]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors ${isRecording ? 'bg-red-600 animate-pulse' : 'bg-indigo-600'}`}>
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">
                OLS Consistency Demo
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                {isRecording ? <span className="text-red-600 font-bold">● REC</span> : "Visualizing Asymptotic Properties"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-600 hidden md:flex">
             <span className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 rounded-full">
               <Activity className="w-4 h-4 text-emerald-500" />
               R² = <span className="font-mono font-bold">{ols.rSquared.toFixed(3)}</span>
             </span>
             <a href="https://en.wikipedia.org/wiki/Consistent_estimator" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition-colors">
               <Info className="w-4 h-4" /> What is Consistency?
             </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* Left Column: Controls (3 cols) */}
          <div className="lg:col-span-3 lg:h-[680px] h-auto sticky top-20">
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
          </div>

          {/* Right Column: Visuals (9 cols) */}
          <div className="lg:col-span-9 flex flex-col gap-6">
            
            {/* Top: Scatter Plot */}
            <MainPlot data={data} ols={ols} params={params} />

            {/* Bottom: Convergence Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ConvergencePlot 
                history={history} 
                trueValue={params.trueIntercept} 
                dataKey="estimatedIntercept" 
                title="Conv. (β₀)"
                color="#ec4899"
              />
              <ConvergencePlot 
                history={history} 
                trueValue={params.trueSlope} 
                dataKey="estimatedSlope" 
                title="Conv. (β₁)"
                color="#4f46e5"
              />
               <ConvergencePlot 
                history={history} 
                trueValue={0} 
                dataKey="slopeStdErr" 
                title="Slope Std. Error (SE)"
                color="#f59e0b"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;