'use client';

import React, { useState, useRef, useEffect } from 'react';
import ScrollArrow from '../ui/scroll-arrow';

const VideoDemo: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
        // Ensure playback rate is set when starting playback
        videoRef.current.playbackRate = 1.2;
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.2; // Set playback speed to 1.2x
      console.log('Video loaded, playback rate set to:', videoRef.current.playbackRate);
    }
    setIsLoaded(true);
    setIsLoading(false);
    setHasError(false);
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video loading error:', e);
    const video = e.currentTarget;
    console.error('Video error details:', {
      error: video.error,
      networkState: video.networkState,
      readyState: video.readyState,
      src: video.src
    });
    setHasError(true);
    setErrorMessage('Failed to load demo video. Please check your connection or try again later.');
    setIsLoading(false);
    setIsLoaded(false);
  };

  const handleVideoCanPlay = () => {
    console.log('Video can play');
    setIsLoaded(true);
    setIsLoading(false);
    setHasError(false);
  };

  // Ensure playback rate is set whenever the video element is available
  useEffect(() => {
    if (videoRef.current && isLoaded) {
      videoRef.current.playbackRate = 1.2;
      console.log('Playback rate set in useEffect:', videoRef.current.playbackRate);
    }
  }, [isLoaded]);

  // Add timeout for video loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading && !hasError) {
        console.warn('Video loading timeout');
        setHasError(true);
        setErrorMessage('Video is taking too long to load. Please check your connection.');
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading, hasError]);

  return (
    <section className="video-demo section-min-height flex flex-col justify-center section-spacing relative overflow-hidden gradient-section">
      <div className="container-custom">
        <div className="text-center mb-fluid-xl">
          <h2 className="font-display text-fluid-2xl text-neutral-0 text-center mb-fluid-lg">
            Experience the Technology
          </h2>
          <p className="text-fluid-base text-neutral-50 max-w-readable mx-auto leading-relaxed">
            See how MinbarAI seamlessly translates sermons and Islamic content in real-time, bridging communities worldwide.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto">
          {/* Video Container with Glass Effect */}
          <div className="relative rounded-2xl overflow-hidden gradient-primary gradient-smooth gradient-optimized backdrop-blur-sm border border-primary-600/30 shadow-2xl hover:shadow-glow-lg transition-all duration-500">
            {/* Video Element */}
            <video
              ref={videoRef}
              className="w-full h-auto rounded-2xl"
              onLoadedData={handleVideoLoad}
              onCanPlay={handleVideoCanPlay}
              onError={handleVideoError}
              onPlay={() => {
                setIsPlaying(true);
                // Set playback rate again when video starts playing
                if (videoRef.current) {
                  videoRef.current.playbackRate = 1.2;
                }
              }}
              onPause={() => setIsPlaying(false)}
              onEnded={() => setIsPlaying(false)}
              controls={false}
              preload="metadata"
              muted
              playsInline
              webkit-playsinline="true"
            >
              <source src="/videos/minbarai-demo-video.webm" type="video/webm" />
              Your browser does not support the video tag.
            </video>

            {/* Loading State */}
            {isLoading && !hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary-800/50 backdrop-blur-sm rounded-2xl">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-neutral-0 font-body">Loading demo...</span>
                </div>
              </div>
            )}

            {/* Error State */}
            {hasError && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary-800/80 backdrop-blur-sm rounded-2xl">
                <div className="text-center p-6">
                  <div className="w-12 h-12 mx-auto mb-4 text-accent-500">
                    <svg fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <p className="text-neutral-0 font-body mb-4">{errorMessage}</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={() => {
                        setHasError(false);
                        setIsLoading(true);
                        setIsLoaded(false);
                        if (videoRef.current) {
                          videoRef.current.load();
                        }
                      }}
                      className="bg-accent-500 hover:bg-accent-400 text-neutral-0 px-4 py-2 rounded-lg transition-colors duration-200"
                    >
                      Try Again
                    </button>
                    <button
                      onClick={() => {
                        // Open video in new tab as fallback
                        window.open('/videos/minbarai-demo-video.webm', '_blank');
                      }}
                      className="bg-primary-600 hover:bg-primary-500 text-neutral-0 px-4 py-2 rounded-lg transition-colors duration-200"
                    >
                      Open Video
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Overlay with Play Button */}
            {!isPlaying && isLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm transition-all duration-300">
                <button
                  onClick={handlePlayPause}
                  className="group relative bg-accent-500 hover:bg-accent-400 text-neutral-0 rounded-full p-6 shadow-glow hover:shadow-glow-lg transition-all duration-300 transform hover:scale-110"
                  aria-label="Play video"
                >
                  <svg
                    className="w-8 h-8 ml-1"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <div className="absolute inset-0 rounded-full bg-accent-400 animate-ping opacity-20"></div>
                </button>
              </div>
            )}

            {/* Video Controls Overlay */}
            {isPlaying && (
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between bg-black/40 backdrop-blur-sm rounded-lg p-3 opacity-0 hover:opacity-100 transition-opacity duration-300">
                <button
                  onClick={handlePlayPause}
                  className="text-neutral-0 hover:text-accent-400 transition-colors duration-200"
                  aria-label={isPlaying ? "Pause video" : "Play video"}
                >
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    {isPlaying ? (
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    ) : (
                      <path d="M8 5v14l11-7z" />
                    )}
                  </svg>
                </button>
                <div className="text-neutral-0 text-sm font-body">
                  MinbarAI Demo
                </div>
                <div className="w-6"></div> {/* Spacer for centering */}
              </div>
            )}
          </div>

          {/* Floating Elements for Visual Appeal */}
          <div className="absolute -top-4 -left-4 w-8 h-8 bg-accent-500/20 rounded-full animate-pulse-slow"></div>
          <div className="absolute -bottom-4 -right-4 w-6 h-6 bg-primary-400/30 rounded-full animate-float"></div>
          <div className="absolute top-1/2 -right-8 w-4 h-4 bg-accent-400/40 rounded-full animate-pulse"></div>
        </div>
        <ScrollArrow targetSelector=".core-pillars" delay="1s" />
      </div>
    </section>
  );
};

export default VideoDemo;
