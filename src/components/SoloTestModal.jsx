import { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  PlayCircle,
  User,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

export default function SoloTestModal({ isOpen = true, onClose, user, profile, onEnterRoom }) {
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animFrameRef = useRef(null);

  const [localStream, setLocalStream] = useState(null);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [micVolume, setMicVolume] = useState(0); // 0-100
  const [deviceError, setDeviceError] = useState('');
  const [isReady, setIsReady] = useState(false);

  // 1. Initial Media Stream Acquisition using Universal Constraints
  useEffect(() => {
    let isCancelled = false;

    const initDeviceTest = async () => {
      setDeviceError('');
      try {
        // Universal constraints — no restrictive facingMode or resolution
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        setLocalStream(stream);

        const hasVideo = stream.getVideoTracks().some((t) => t.enabled);
        const hasAudio = stream.getAudioTracks().some((t) => t.enabled);
        setIsCameraOn(hasVideo);
        setIsMicOn(hasAudio);
        setIsReady(true);
      } catch (err) {
        console.warn('[SoloTestModal] Video+Audio acquisition failed:', err);
        // Fallback: Video only
        try {
          const vStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          if (isCancelled) {
            vStream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = vStream;
          setLocalStream(vStream);
          setIsCameraOn(true);
          setIsMicOn(false);
          setIsReady(true);
          return;
        } catch (vErr) {
          console.warn('[SoloTestModal] Video-only fallback failed:', vErr);
        }

        // Fallback: Audio only
        try {
          const aStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          if (isCancelled) {
            aStream.getTracks().forEach((t) => t.stop());
            return;
          }
          localStreamRef.current = aStream;
          setLocalStream(aStream);
          setIsCameraOn(false);
          setIsMicOn(true);
          setIsReady(true);
          return;
        } catch (aErr) {
          console.warn('[SoloTestModal] Audio-only fallback failed:', aErr);
        }

        if (!isCancelled) {
          setIsCameraOn(false);
          setIsMicOn(false);
          setDeviceError('Camera or microphone permissions were denied or are unavailable on this device.');
        }
      }
    };

    if (isOpen) {
      initDeviceTest();
    }

    return () => {
      isCancelled = true;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          try { t.stop(); } catch { /* best effort */ }
        });
        localStreamRef.current = null;
      }
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [isOpen]);

  // 2. Reactive useEffect: Guarantees localVideoRef receives srcObject whenever localStream is available
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      if (localVideoRef.current.srcObject !== localStream) {
        localVideoRef.current.srcObject = localStream;
      }
      localVideoRef.current.muted = true;
      localVideoRef.current.volume = 0;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, isCameraOn]);

  // 3. Real-Time Audio Level Meter (Web Audio API)
  useEffect(() => {
    if (!localStream || !isMicOn) {
      setMicVolume(0);
      return;
    }

    const audioTrack = localStream.getAudioTracks().find((t) => t.readyState === 'live' && t.enabled);
    if (!audioTrack) {
      setMicVolume(0);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(localStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.4;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / (dataArray.length || 1);
          setMicVolume(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      }
    } catch {
      /* fallback */
    }

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    };
  }, [localStream, isMicOn]);

  // 4. Toggle Camera: actively acquires track if missing
  const toggleCam = useCallback(async () => {
    const videoTracks = localStreamRef.current?.getVideoTracks?.() || [];
    const activeTrack = videoTracks.find((t) => t.readyState === 'live');

    if (!activeTrack) {
      try {
        const vStream = await navigator.mediaDevices.getUserMedia({ video: true });
        const newTrack = vStream.getVideoTracks()[0];
        if (newTrack) {
          newTrack.enabled = true;
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream([newTrack]);
          } else {
            videoTracks.forEach((t) => {
              try { localStreamRef.current.removeTrack(t); } catch { /* ignore */ }
            });
            localStreamRef.current.addTrack(newTrack);
          }
          setLocalStream(localStreamRef.current);
          setIsCameraOn(true);

          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
            localVideoRef.current.muted = true;
            localVideoRef.current.play().catch(() => {});
          }
        }
      } catch (err) {
        console.warn('[SoloTestModal] Failed to acquire video track on toggleCam:', err);
      }
      return;
    }

    const nextState = !activeTrack.enabled;
    videoTracks.forEach((t) => {
      t.enabled = nextState;
    });
    setLocalStream(localStreamRef.current);
    setIsCameraOn(nextState);
  }, []);

  // 5. Toggle Mic: actively acquires track if missing
  const toggleMic = useCallback(async () => {
    const audioTracks = localStreamRef.current?.getAudioTracks?.() || [];
    const activeTrack = audioTracks.find((t) => t.readyState === 'live');

    if (!activeTrack) {
      try {
        const aStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const newTrack = aStream.getAudioTracks()[0];
        if (newTrack) {
          newTrack.enabled = true;
          if (!localStreamRef.current) {
            localStreamRef.current = new MediaStream([newTrack]);
          } else {
            audioTracks.forEach((t) => {
              try { localStreamRef.current.removeTrack(t); } catch { /* ignore */ }
            });
            localStreamRef.current.addTrack(newTrack);
          }
          setLocalStream(localStreamRef.current);
          setIsMicOn(true);
        }
      } catch (err) {
        console.warn('[SoloTestModal] Failed to acquire audio track on toggleMic:', err);
      }
      return;
    }

    const nextState = !activeTrack.enabled;
    audioTracks.forEach((t) => {
      t.enabled = nextState;
    });
    setLocalStream(localStreamRef.current);
    setIsMicOn(nextState);
  }, []);

  if (!isOpen) return null;

  const displayName = profile?.username || user?.displayName || 'You';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in font-sans">
      <div className="bg-stone-900 border border-white/15 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl relative flex flex-col gap-5 animate-scale-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[#FCA311] flex items-center justify-center">
              <PlayCircle size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-tight">Hardware & Device Test</h3>
              <p className="text-xs text-slate-400">Preview your webcam and microphone before joining live calls.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Device Warning / Error Banner */}
        {deviceError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium">
            {deviceError}
          </div>
        )}

        {/* Video Stage: The video element MUST ALWAYS be mounted in the DOM */}
        <div className="w-full aspect-video rounded-2xl bg-[#111318] border border-white/10 overflow-hidden relative flex items-center justify-center shadow-inner">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover -scale-x-100 transition-opacity duration-200 ${
              isCameraOn ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            }`}
          />

          {/* Avatar Placeholder: Toggled via opacity, NEVER unmounting or display:none on video */}
          <div
            className={`flex flex-col items-center justify-center gap-3 p-4 transition-opacity duration-200 ${
              isCameraOn ? 'opacity-0 pointer-events-none absolute' : 'opacity-100'
            }`}
          >
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-amber-600 p-[3px] shadow-[0_0_30px_rgba(245,158,11,0.3)]">
              <div className="w-full h-full rounded-full bg-[#14213D] flex items-center justify-center text-white font-extrabold text-3xl">
                {displayName.charAt(0).toUpperCase() || <User size={32} />}
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-white">{displayName}</p>
              <span className="text-xs font-semibold text-amber-400">Camera Off</span>
            </div>
          </div>

          {/* Top-Left Live Status Badge */}
          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
            <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-xs font-mono font-bold text-amber-400 flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>Self Preview</span>
            </div>
            {isReady && (
              <div className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-1 backdrop-blur-md">
                <CheckCircle2 size={12} /> Ready
              </div>
            )}
          </div>

          {/* Bottom Bar: Mic Meter */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between z-10 bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2.5 rounded-xl">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <ShieldCheck size={14} className="text-emerald-400" />
              <span>{isMicOn ? 'Microphone Active' : 'Microphone Muted'}</span>
            </div>

            {/* Audio Level Bar */}
            <div className="flex items-center gap-2">
              <Mic size={14} className={micVolume > 5 ? 'text-emerald-400 animate-pulse' : 'text-slate-400'} />
              <div className="w-24 sm:w-36 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 transition-all duration-75 rounded-full"
                  style={{ width: `${isMicOn ? Math.max(4, micVolume) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls Dock */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-2.5">
            {/* Mic Toggle */}
            <button
              onClick={toggleMic}
              className={`p-3 rounded-full transition flex items-center justify-center cursor-pointer active:scale-95 ${
                isMicOn
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
              title={isMicOn ? 'Mute Microphone' : 'Unmute Microphone'}
            >
              {isMicOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>

            {/* Camera Toggle */}
            <button
              onClick={toggleCam}
              className={`p-3 rounded-full transition flex items-center justify-center cursor-pointer active:scale-95 ${
                isCameraOn
                  ? 'bg-white/10 hover:bg-white/20 text-white'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              }`}
              title={isCameraOn ? 'Turn Off Camera' : 'Turn On Camera'}
            >
              {isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/10 transition cursor-pointer"
            >
              Close
            </button>
            {typeof onEnterRoom === 'function' && (
              <button
                onClick={onEnterRoom}
                className="px-5 py-2.5 rounded-xl bg-[#FCA311] hover:bg-[#E5930B] text-[#14213D] font-extrabold text-xs shadow-lg transition flex items-center gap-1.5 cursor-pointer"
              >
                <PlayCircle size={14} /> Launch Full Solo Room
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
