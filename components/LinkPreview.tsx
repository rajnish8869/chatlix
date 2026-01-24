
import React, { useEffect, useState } from 'react';

interface LinkData {
  title: string;
  description: string;
  image: string;
  url: string;
  publisher: string;
}

export const LinkPreview: React.FC<{ url: string; isMe: boolean }> = ({ url, isMe }) => {
  const [data, setData] = useState<LinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        // Using Microlink API as a proxy to fetch OG data (simulating edge function)
        const response = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
        const json = await response.json();

        if (json.status === 'success' && isMounted) {
          const { title, description, image, logo } = json.data;
          if (!title) {
             setError(true);
             return;
          }
          setData({
            title,
            description,
            image: image?.url,
            url,
            publisher: json.data.publisher || new URL(url).hostname
          });
        } else {
          setError(true);
        }
      } catch (e) {
        if (isMounted) setError(true);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [url]);

  if (error) return null;

  if (loading) {
    return (
      <div className={`mt-2 rounded-xl overflow-hidden flex flex-col w-full max-w-[280px] ${isMe ? 'bg-black/10' : 'bg-black/5'} animate-pulse`}>
         <div className="h-32 bg-white/10 w-full" />
         <div className="p-3 space-y-2">
             <div className="h-3 bg-white/10 rounded w-3/4" />
             <div className="h-2 bg-white/10 rounded w-full" />
         </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`
        mt-2 block rounded-xl overflow-hidden transition-all hover:opacity-90 active:scale-[0.98]
        ${isMe ? 'bg-black/20 text-white' : 'bg-surface-highlight text-text-main'}
        border border-white/5 max-w-full
      `}
    >
      {data.image && (
        <div className="h-32 w-full overflow-hidden relative bg-black/20">
            <img 
                src={data.image} 
                alt={data.title} 
                className="w-full h-full object-cover transition-transform hover:scale-105 duration-700" 
            />
        </div>
      )}
      <div className="p-3 flex flex-col gap-1">
        <h4 className="font-bold text-[13px] leading-tight line-clamp-2">
            {data.title}
        </h4>
        {data.description && (
            <p className={`text-[11px] line-clamp-2 ${isMe ? 'text-white/70' : 'text-text-sub'}`}>
                {data.description}
            </p>
        )}
        <span className={`text-[10px] mt-1 font-mono uppercase tracking-wider opacity-60`}>
            {data.publisher}
        </span>
      </div>
    </a>
  );
};
