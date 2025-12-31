const STATUS_COLORS = {
  draft: {
    bg: 'bg-slate-500/20',
    text: 'text-slate-400',
    border: 'border-slate-500/30',
  },
  todo: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
  in_progress: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  done: {
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  archived: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/30',
  },
} as const;

export type ChangeStatus = keyof typeof STATUS_COLORS;

export function getStatusColor(status: ChangeStatus) {
  return STATUS_COLORS[status] || STATUS_COLORS.draft;
}
