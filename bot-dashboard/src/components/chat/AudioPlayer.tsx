// src/components/chat/AudioPlayer.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, IconButton, Slider, Typography, Tooltip, CircularProgress, Link } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

interface AudioPlayerProps {
  src?: string | null;
  durationSeconds?: number;
  isUser?: boolean;
}

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  durationSeconds,
  isUser = false,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(durationSeconds || 0);
  const [isBuffering, setIsBuffering] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isSeeking, setIsSeeking] = useState(false);

  useEffect(() => {
    if (durationSeconds && durationSeconds > 0) {
      setDuration(durationSeconds);
    }
  }, [durationSeconds]);

  // Reset state when src changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setHasError(!src);
    setIsBuffering(false);
  }, [src]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !src || hasError) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => {
        console.warn('Audio playback failed:', err);
        setHasError(true);
        setIsPlaying(false);
      });
    }
  }, [isPlaying, src, hasError]);

  const handleTimeUpdate = () => {
    if (audioRef.current && !isSeeking) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      if (audioRef.current.duration && !isNaN(audioRef.current.duration) && isFinite(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
      setHasError(false);
    }
  };

  const handleSeekChange = (_: Event, value: number | number[]) => {
    const newTime = Array.isArray(value) ? value[0] : value;
    setCurrentTime(newTime);
  };

  const handleSeekCommitted = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const newTime = Array.isArray(value) ? value[0] : value;
    setIsSeeking(false);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  if (!src) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, color: 'text.secondary' }}>
        <ErrorOutlineIcon fontSize="small" color="disabled" />
        <Typography variant="caption">Audio recording unavailable</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        width: '100%',
        minWidth: 240,
        maxWidth: 320,
        pt: 0.5,
      }}
    >
      {/* Hidden Native Audio Element */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onError={() => {
          setHasError(true);
          setIsBuffering(false);
          setIsPlaying(false);
        }}
      />

      {/* Main Player Row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
        {/* Play/Pause / Buffering Button */}
        <IconButton
          onClick={togglePlay}
          disabled={hasError}
          size="small"
          sx={{
            bgcolor: isUser ? 'primary.main' : 'primary.dark',
            color: '#FFFFFF',
            width: 36,
            height: 36,
            flexShrink: 0,
            '&:hover': {
              bgcolor: isUser ? 'primary.dark' : 'primary.main',
            },
            '&.Mui-disabled': {
              bgcolor: 'action.disabledBackground',
              color: 'action.disabled',
            },
          }}
        >
          {isBuffering ? (
            <CircularProgress size={18} sx={{ color: '#FFFFFF' }} />
          ) : isPlaying ? (
            <PauseIcon sx={{ fontSize: 20 }} />
          ) : (
            <PlayArrowIcon sx={{ fontSize: 20 }} />
          )}
        </IconButton>

        {/* Scrubber & Time */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Slider
            size="small"
            value={currentTime}
            min={0}
            max={duration > 0 ? duration : 100}
            disabled={hasError || duration === 0}
            onChange={handleSeekChange}
            onChangeCommitted={handleSeekCommitted}
            onMouseDown={() => setIsSeeking(true)}
            sx={{
              py: 0.5,
              color: isUser ? 'primary.main' : 'primary.dark',
              '& .MuiSlider-thumb': {
                width: 10,
                height: 10,
                transition: '0.2s',
                '&:hover, &.Mui-focusVisible': {
                  boxShadow: '0 0 0 6px rgba(25, 118, 210, 0.16)',
                },
              },
              '& .MuiSlider-rail': {
                opacity: 0.28,
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: -0.5 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontFamily: 'monospace' }}>
              {formatTime(currentTime)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.68rem', fontFamily: 'monospace' }}>
              {formatTime(duration)}
            </Typography>
          </Box>
        </Box>

        {/* Speed button */}
        <Tooltip title="Playback Speed">
          <Box
            onClick={toggleSpeed}
            sx={{
              px: 0.8,
              py: 0.2,
              borderRadius: 1,
              bgcolor: 'action.hover',
              cursor: 'pointer',
              userSelect: 'none',
              fontSize: '0.68rem',
              fontWeight: 700,
              color: 'text.secondary',
              flexShrink: 0,
              '&:hover': {
                bgcolor: 'action.selected',
                color: 'text.primary',
              },
            }}
          >
            {playbackRate}x
          </Box>
        </Tooltip>
      </Box>

      {/* Error Fallback / Direct Link */}
      {hasError && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            bgcolor: 'rgba(211, 47, 47, 0.08)',
            p: 0.75,
            borderRadius: 1,
            mt: 0.5,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <GraphicEqIcon sx={{ fontSize: 14, color: 'error.main' }} />
            <Typography variant="caption" sx={{ color: 'error.main', fontSize: '0.7rem' }}>
              Audio stream error
            </Typography>
          </Box>
          <Link
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.3,
              fontSize: '0.7rem',
              color: 'primary.main',
              fontWeight: 600,
            }}
          >
            Open <OpenInNewIcon sx={{ fontSize: 12 }} />
          </Link>
        </Box>
      )}
    </Box>
  );
};

export default React.memo(AudioPlayer);
