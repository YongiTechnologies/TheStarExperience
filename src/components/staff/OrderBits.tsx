import React from 'react';
import { Check, ChefHat, GlassWater, MessageSquare } from 'lucide-react';
import { formatAge, minutesSince } from '@/lib/useNow';
import { StaffOrder, StationName, StationState } from '@/types';

/** "Waiting 7 min", coloured by urgency (thresholds in minutes). */
export function AgeBadge({ since, now, warnAt = 5, alarmAt = 10, prefix = '' }: {
  since: string | null;
  now: number;
  warnAt?: number;
  alarmAt?: number;
  prefix?: string;
}) {
  const minutes = minutesSince(since, now);
  const tone =
    minutes >= alarmAt
      ? 'bg-flag-red/15 text-flag-red ring-flag-red/40'
      : minutes >= warnAt
        ? 'bg-star-gold/15 text-star-gold ring-star-gold/40'
        : 'bg-white/5 text-dust ring-white/10';
  return (
    <span className={`inline-flex items-center h-7 px-2.5 rounded-full text-[12px] font-semibold tabular ring-1 ${tone}`}>
      {prefix}
      {formatAge(since, now)}
    </span>
  );
}

const STATION_META: Record<StationName, { label: string; Icon: React.ElementType }> = {
  kitchen: { label: 'Kitchen', Icon: ChefHat },
  bar: { label: 'Bar', Icon: GlassWater },
};

const STATE_LABEL: Record<StationState, string> = { queued: 'queued', preparing: 'preparing', ready: 'ready' };

/** Kitchen / bar progress for one order. */
export function StationChips({ order }: { order: StaffOrder }) {
  const stations = (['kitchen', 'bar'] as StationName[]).filter((s) => order[`${s}_status`]);
  return (
    <div className="flex flex-wrap gap-2">
      {stations.map((station) => {
        const state = order[`${station}_status`] as StationState;
        const { label, Icon } = STATION_META[station];
        return (
          <span
            key={station}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[13px] font-semibold ring-1 ${
              state === 'ready'
                ? 'bg-flag-green/15 text-flag-green ring-flag-green/40'
                : state === 'preparing'
                  ? 'bg-star-gold/15 text-star-gold ring-star-gold/40'
                  : 'bg-white/5 text-dust ring-white/10'
            }`}
          >
            {state === 'ready' ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Icon className="w-3.5 h-3.5" />}
            {label} {STATE_LABEL[state]}
          </span>
        );
      })}
    </div>
  );
}

/** The order's lines ("2× Kokoroko"), optionally marked by station. */
export function OrderLines({ order, large = false, showStation = false }: { order: StaffOrder; large?: boolean; showStation?: boolean }) {
  return (
    <ul className={`space-y-1 ${large ? 'text-[18px]' : 'text-[15px]'}`}>
      {order.items.map((line, i) => (
        <li key={i} className="flex items-baseline gap-2.5">
          <span className={`font-display font-extrabold text-star-gold tabular ${large ? 'text-2xl w-9' : 'text-lg w-7'}`}>{line.quantity}×</span>
          <span className="flex-1 font-semibold leading-snug">{line.name}</span>
          {showStation && (
            <span className="text-[11px] uppercase tracking-wider text-dust">{line.station}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function NoteCallout({ notes }: { notes: string | null }) {
  if (!notes) return null;
  return (
    <p className="flex items-start gap-2 rounded-xl bg-star-gold/10 ring-1 ring-star-gold/30 px-3 py-2 text-[14px] font-semibold text-star-gold">
      <MessageSquare className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{notes}</span>
    </p>
  );
}
