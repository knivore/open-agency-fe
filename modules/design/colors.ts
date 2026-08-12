/**
 * Canvas renderers cannot consume CSS custom properties reliably, so they use
 * this small semantic palette instead of inventing renderer-local colours.
 */
export const agencyColors = {
  activity: '#B6FF2E',
  activitySoft: '#D9FF9B',
  backgroundDark: '#15171C',
  borderDark: '#343842',
  borderLight: '#D9D7D2',
  graphite: '#23262F',
  graphiteLight: '#F1F0ED',
  graphiteMuted: '#747985',
  porcelain: '#F8F7F4',
  success: '#15803D',
  successBright: '#4ADE80',
  violet: '#6A00F4',
  violetBright: '#A66CFF',
  violetSoft: '#D9C5FF',
  warning: '#B45309',
  warningBright: '#FBBF24',
  error: '#DC2626',
  errorBright: '#FB7185',
} as const;

export const graphStateColors = {
  completed: agencyColors.success,
  completedDark: agencyColors.successBright,
  failed: agencyColors.error,
  failedDark: agencyColors.errorBright,
  idle: agencyColors.graphiteMuted,
  running: agencyColors.activity,
  selected: agencyColors.violet,
  selectedDark: agencyColors.violetBright,
  warning: agencyColors.warning,
  warningDark: agencyColors.warningBright,
} as const;
