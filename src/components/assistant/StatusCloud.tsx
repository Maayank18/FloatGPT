import { X } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { StatusCloud as StatusCloudInfo } from '../../lib/guardian';

export function StatusCloudBubble({
  cloud,
  style,
  align = 'left',
  onOpen,
  onDismiss,
  onEnter,
  onLeave,
}: {
  cloud: StatusCloudInfo;
  style?: CSSProperties;
  align?: 'left' | 'right';
  onOpen: () => void;
  onDismiss: () => void;
  onEnter?: () => void;
  onLeave?: () => void;
}) {
  const warm = cloud.band === 'WARNING';
  const fill = warm ? 'bg-amber-400' : 'bg-red-600';
  const ink = warm ? 'text-black' : 'text-white';
  const tail = align === 'right' ? 'right-6' : 'left-6';
  const tailTip = align === 'right' ? 'right-3' : 'left-3';

  return (
    <div
      className="absolute z-50 electron-no-drag w-[214px]"
      style={{ pointerEvents: 'auto', ...style }}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      onClick={onOpen}
      title={cloud.title}
    >
      <div className="relative px-1 pt-3 pb-3">
        <span className={`absolute left-5 top-1 h-7 w-7 rounded-full ${fill}`} />
        <span className={`absolute left-10 top-0 h-9 w-10 rounded-full ${fill}`} />
        <span className={`absolute right-7 top-1 h-7 w-8 rounded-full ${fill}`} />
        <div className={`relative z-10 rounded-[22px] px-3.5 pb-2 pt-2.5 text-center shadow-[0_8px_16px_rgba(0,0,0,0.16)] ${fill} ${ink}`}>
          <span className="block text-[12px] font-semibold leading-snug">{cloud.title}</span>
          <span className={`block text-[11px] font-medium mt-0.5 ${warm ? 'text-black/70' : 'text-white/80'}`}>{cloud.timeText}</span>
          <button
            type="button"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDismiss();
            }}
            className="absolute -top-1 -right-1 z-20 w-4 h-4 flex items-center justify-center rounded-full bg-black/35 hover:bg-black/55 text-white cursor-pointer"
            style={{ WebkitAppRegion: 'no-drag', pointerEvents: 'auto' } as CSSProperties}
            title="Hide this note"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
        <span className={`absolute bottom-1.5 h-3.5 w-3.5 rounded-full ${fill} ${tail}`} />
        <span className={`absolute bottom-0 h-2 w-2 rounded-full ${fill} ${tailTip}`} />
      </div>
    </div>
  );
}
