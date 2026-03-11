'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Play, X } from 'lucide-react';
import { eventBus } from '@flipfeeds/game-client/events';

// Video content registry — maps zone IDs to YouTube videos
const VIDEO_CONTENT: Record<string, { title: string; description: string; videoId: string }> = {
  'stage-main': {
    title: 'Main Stage — CodingCat.dev',
    description: 'Watch the latest from CodingCat.dev',
    videoId: 'dQw4w9WgXcQ', // Placeholder — replace with real CodingCat.dev video
  },
  'stage-side': {
    title: 'Side Stage — Tech Talk',
    description: 'Deep dive into web game development',
    videoId: 'dQw4w9WgXcQ', // Placeholder
  },
};

// Default video for unknown zones
const DEFAULT_VIDEO = {
  title: 'Video Stage',
  description: 'Watch the presentation',
  videoId: 'dQw4w9WgXcQ',
};

export function VideoDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<{
    title: string;
    description: string;
    videoId: string;
  } | null>(null);

  // Listen for ZONE_INTERACT events on video zones
  useEffect(() => {
    const handleInteract = (data: { zoneId: string; zoneType: string }) => {
      if (data.zoneType === 'video') {
        const content = VIDEO_CONTENT[data.zoneId] || DEFAULT_VIDEO;
        setActiveVideo(content);
        setIsOpen(true);
      }
    };
    eventBus.on('ZONE_INTERACT', handleInteract);
    return () => { eventBus.off('ZONE_INTERACT', handleInteract); };
  }, []);

  // CRITICAL: Pause/resume game input
  useEffect(() => {
    if (isOpen) {
      eventBus.emit('PAUSE_INPUT');
    } else {
      eventBus.emit('RESUME_INPUT');
    }
  }, [isOpen]);

  const handleOpenChange = useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setActiveVideo(null);
    }
  }, []);

  if (!activeVideo) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[800px] w-[90vw] max-h-[85vh] bg-background/95 backdrop-blur-md border-border p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="flex items-center justify-center size-8 rounded-full bg-destructive/20">
              <Play className="size-4 text-destructive fill-destructive" />
            </div>
            {activeVideo.title}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {activeVideo.description}
          </DialogDescription>
        </DialogHeader>

        {/* YouTube embed */}
        <div className="px-6 pb-6">
          <div className="relative w-full rounded-xl overflow-hidden bg-black" style={{ paddingBottom: '56.25%' }}>
            <iframe
              className="absolute inset-0 w-full h-full"
              src={`https://www.youtube.com/embed/${activeVideo.videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={activeVideo.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
