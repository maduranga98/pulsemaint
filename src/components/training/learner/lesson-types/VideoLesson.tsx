import { useRef, useState, useEffect, useCallback } from 'react';
// updateVideoProgress used for progress tracking only (not lesson completion)
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  CheckCircle,
} from 'lucide-react';
import { useLessonProgress } from '@/hooks/training/useLessonProgress';
import type { LessonItem, LessonProgress } from '@/lib/training/trainingTypes';

interface VideoLessonProps {
  lesson: LessonItem;
  assignmentId: string;
  progress?: LessonProgress;
  onComplete: (lessonId: string) => void;
}

const fmt = (s: number): string => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const SPEEDS = [0.75, 1, 1.25, 1.5];
const PROGRESS_INTERVAL_MS = 5000;
const AUTO_COMPLETE_PCT = 80;
const CONTROLS_HIDE_DELAY = 2500;

export default function VideoLesson({ lesson, assignmentId, progress, onComplete }: VideoLessonProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideControlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTapRef = useRef<{ side: 'left' | 'right'; time: number } | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isCompleted, setIsCompleted] = useState(progress?.completed ?? false);
  const [showCenterPlay, setShowCenterPlay] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [subtitlesOn, setSubtitlesOn] = useState(false);
  const [seekFlash, setSeekFlash] = useState<{ side: 'left' | 'right'; show: boolean }>({ side: 'left', show: false });

  const { updateVideoProgress } = useLessonProgress();

  // Resume from saved progress
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !progress?.watchedSeconds) return;
    const onLoaded = () => {
      if (progress.watchedSeconds > 0 && progress.watchedSeconds < video.duration - 2) {
        video.currentTime = progress.watchedSeconds;
      }
    };
    video.addEventListener('loadedmetadata', onLoaded);
    return () => video.removeEventListener('loadedmetadata', onLoaded);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress reporting interval
  useEffect(() => {
    if (!isPlaying) {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      return;
    }
    progressIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;
      updateVideoProgress(assignmentId, lesson.id, video.currentTime, video.duration || lesson.durationSeconds);
    }, PROGRESS_INTERVAL_MS);
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, assignmentId, lesson.id, lesson.durationSeconds, updateVideoProgress]);

  // Controls auto-hide
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    if (isPlaying) {
      hideControlsTimer.current = setTimeout(() => setShowControls(false), CONTROLS_HIDE_DELAY);
    }
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    };
  }, []);

  // Fullscreen change listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
    setShowCenterPlay(true);
    setTimeout(() => setShowCenterPlay(false), 600);
    resetHideTimer();
  }, [resetHideTimer]);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    setCurrentTime(video.currentTime);
    const pct = video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0;
    if (!isCompleted && pct >= AUTO_COMPLETE_PCT) {
      setIsCompleted(true);
      onComplete(lesson.id);
    }
  }, [isCompleted, lesson.id, onComplete]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    setShowControls(true);
    if (!isCompleted) {
      setIsCompleted(true);
      onComplete(lesson.id);
    }
  }, [isCompleted, lesson.id, onComplete]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Number(e.target.value);
    setCurrentTime(Number(e.target.value));
    resetHideTimer();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleSpeedChange = (rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  };

  const toggleSubtitles = () => {
    const video = videoRef.current;
    if (!video) return;
    const track = video.textTracks[0];
    if (track) {
      track.mode = subtitlesOn ? 'disabled' : 'showing';
      setSubtitlesOn(!subtitlesOn);
    }
  };

  const handleMarkComplete = () => {
    setIsCompleted(true);
    onComplete(lesson.id);
  };

  // Double-tap seek (mobile)
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const touch = e.changedTouches[0];
    const x = touch.clientX - rect.left;
    const side: 'left' | 'right' = x < rect.width / 2 ? 'left' : 'right';
    const now = Date.now();

    if (lastTapRef.current && lastTapRef.current.side === side && now - lastTapRef.current.time < 300) {
      const video = videoRef.current;
      if (video) {
        video.currentTime = Math.max(0, video.currentTime + (side === 'left' ? -10 : 10));
        setSeekFlash({ side, show: true });
        setTimeout(() => setSeekFlash((f) => ({ ...f, show: false })), 500);
      }
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { side, time: now };
    }
  };

  const watchedPct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const canComplete = watchedPct >= AUTO_COMPLETE_PCT;

  return (
    <div
      ref={containerRef}
      className="relative bg-black select-none"
      onMouseMove={resetHideTimer}
      onTouchEnd={handleTouchEnd}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={lesson.contentUrl}
        className="w-full max-h-[calc(100vh-120px)] object-contain"
        playsInline
        onPlay={() => { setIsPlaying(true); resetHideTimer(); }}
        onPause={() => { setIsPlaying(false); setShowControls(true); if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current); }}
        onTimeUpdate={handleTimeUpdate}
        onDurationChange={() => setDuration(videoRef.current?.duration ?? 0)}
        onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
        onWaiting={() => setIsBuffering(true)}
        onCanPlay={() => setIsBuffering(false)}
        onEnded={handleEnded}
        aria-label={lesson.title}
      >
        {lesson.subtitleUrl && (
          <track kind="subtitles" src={lesson.subtitleUrl} default={subtitlesOn} />
        )}
      </video>

      {/* Buffering spinner */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin" aria-label="Buffering" />
        </div>
      )}

      {/* Center play/pause flash */}
      {showCenterPlay && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-black/50 rounded-full p-4">
            {isPlaying ? <Pause size={32} className="text-white" /> : <Play size={32} className="text-white" />}
          </div>
        </div>
      )}

      {/* Seek flash indicators */}
      {seekFlash.show && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 pointer-events-none ${seekFlash.side === 'left' ? 'left-6' : 'right-6'}`}
        >
          <div className="bg-black/60 text-white text-sm font-medium px-3 py-1.5 rounded-lg">
            {seekFlash.side === 'left' ? '-10s' : '+10s'}
          </div>
        </div>
      )}

      {/* Click to play/pause overlay */}
      <button
        type="button"
        className="absolute inset-0 w-full h-full cursor-pointer"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause video' : 'Play video'}
        style={{ background: 'transparent' }}
      />

      {/* Controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={duration || 1}
          step={0.5}
          value={currentTime}
          onChange={handleSeek}
          onClick={(e) => e.stopPropagation()}
          className="w-full h-1 accent-blue-500 cursor-pointer mb-2"
          aria-label="Seek video"
        />

        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="text-white hover:text-blue-400 transition-colors shrink-0"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>

          {/* Time */}
          <span className="text-white text-xs font-mono shrink-0">
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div className="flex-1" />

          {/* Subtitles toggle */}
          {lesson.subtitleUrl && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleSubtitles(); }}
              className={`text-xs font-bold px-1.5 py-0.5 rounded border transition-colors ${subtitlesOn ? 'text-blue-400 border-blue-400' : 'text-white/70 border-white/40'}`}
              aria-label={subtitlesOn ? 'Disable subtitles' : 'Enable subtitles'}
              aria-pressed={subtitlesOn}
            >
              CC
            </button>
          )}

          {/* Volume (desktop only) */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            className="hidden sm:block text-white hover:text-blue-400 transition-colors"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Speed */}
          <select
            value={playbackRate}
            onChange={(e) => { e.stopPropagation(); handleSpeedChange(Number(e.target.value)); }}
            onClick={(e) => e.stopPropagation()}
            className="bg-transparent text-white text-xs border border-white/40 rounded px-1 py-0.5 cursor-pointer"
            aria-label="Playback speed"
          >
            {SPEEDS.map((s) => (
              <option key={s} value={s} className="bg-gray-900">
                {s}x
              </option>
            ))}
          </select>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
            className="text-white hover:text-blue-400 transition-colors"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      {/* Mark as Complete button */}
      <div className="p-4 bg-white border-t border-slate-200">
        {isCompleted ? (
          <div className="flex items-center gap-2 text-green-600 font-medium">
            <CheckCircle size={18} aria-hidden="true" />
            <span>Lesson complete</span>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleMarkComplete}
            disabled={!canComplete}
            className={`w-full sm:w-auto px-6 py-3 rounded-lg font-medium text-base transition-colors ${
              canComplete
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
            aria-label="Mark video lesson as complete"
          >
            {canComplete ? 'Mark as Complete' : `Watch ${AUTO_COMPLETE_PCT}% to complete`}
          </button>
        )}
      </div>
    </div>
  );
}
