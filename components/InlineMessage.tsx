'use client';

import { InlineMessagePart, parseInlineMessageParts } from '@/lib/crypto';

type InlineMessageProps = {
  message: string;
  className?: string;
  maxMediaHeightClassName?: string;
  iframeHeightClassName?: string;
  showMediaLabel?: boolean;
};

export function InlineMessage({
  message,
  className = '',
  maxMediaHeightClassName = 'max-h-[220px]',
  iframeHeightClassName = 'h-[220px]',
  showMediaLabel = false,
}: InlineMessageProps) {
  const parts = parseInlineMessageParts(message);

  const renderMediaTile = (part: Extract<InlineMessagePart, { kind: 'media' }>, index: number) => (
    <div
      key={`${part.value}-${index}`}
      className="w-[min(260px,100%)] overflow-hidden rounded-lg border border-zinc-700 bg-black align-top"
    >
      {showMediaLabel && (
        <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-950/80 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500">
          <span>Embedded Media</span>
          <span>{part.media.kind.toUpperCase()}</span>
        </div>
      )}
      {part.media.kind === 'image' && (
        <img
          src={part.media.src}
          alt="Embedded media"
          className={`w-full object-contain bg-black ${maxMediaHeightClassName}`}
          loading="lazy"
        />
      )}
      {part.media.kind === 'video' && (
        <video
          src={part.media.src}
          controls
          playsInline
          className={`w-full bg-black ${maxMediaHeightClassName}`}
        />
      )}
      {part.media.kind === 'iframe' && (
        <iframe
          src={part.media.src}
          title="Embedded media"
          className={`w-full bg-black ${iframeHeightClassName}`}
          loading="lazy"
          allow="autoplay; fullscreen; picture-in-picture"
        />
      )}
    </div>
  );

  const renderParts = () => {
    const rendered = [];

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index];

      if (part.kind === 'text') {
        rendered.push(<span key={index}>{part.value}</span>);
        continue;
      }

      if (part.kind === 'link') {
        rendered.push(
          <a
            key={index}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 underline decoration-purple-500/60 underline-offset-2 hover:text-purple-300"
          >
            {part.value}
          </a>
        );
        continue;
      }

      const mediaParts: { part: Extract<InlineMessagePart, { kind: 'media' }>; index: number }[] = [
        { part, index },
      ];

      while (
        index + 2 < parts.length &&
        parts[index + 1].kind === 'text' &&
        /^\s+$/.test(parts[index + 1].value) &&
        parts[index + 2].kind === 'media'
      ) {
        index += 2;
        mediaParts.push({ part: parts[index] as Extract<InlineMessagePart, { kind: 'media' }>, index });
      }

      rendered.push(
        <div key={`media-run-${index}`} className="my-3 flex max-w-full flex-wrap items-start gap-2">
          {mediaParts.map(({ part: mediaPart, index: mediaIndex }) => renderMediaTile(mediaPart, mediaIndex))}
        </div>
      );
    }

    return rendered;
  };

  return (
    <div className={`whitespace-pre-wrap break-words ${className}`}>
      {renderParts()}
    </div>
  );
}
