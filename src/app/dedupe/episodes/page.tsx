'use client';
import { useState } from 'react';
import { DupList } from '@/components/DupList';

type Lib = 'all' | 'show' | 'anime';

export default function EpisodesPage() {
  const [lib, setLib] = useState<Lib>('all');
  return (
    <DupList
      key={lib}
      filterSection={lib === 'all' ? 'episodes' : lib}
      emptyTitle={`No ${lib === 'anime' ? 'anime' : lib === 'show' ? 'TV' : 'episode'} duplicates`}
      libraryFilter={
        <select
          value={lib}
          onChange={(e) => setLib(e.target.value as Lib)}
          className="px-3 py-1.5 bg-panel-2 border border-border rounded-md text-sm"
        >
          <option value="all">All libraries</option>
          <option value="show">TV Shows</option>
          <option value="anime">Anime</option>
        </select>
      }
    />
  );
}
