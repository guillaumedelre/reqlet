import type { HttpMethod } from '@/types';

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'];

export const METHOD_LABEL_WIDTH: Record<HttpMethod, string> = {
  GET:     'w-[46px]',
  POST:    'w-[46px]',
  PUT:     'w-[46px]',
  PATCH:   'w-[52px]',
  DELETE:  'w-[52px]',
  OPTIONS: 'w-[60px]',
  HEAD:    'w-[46px]',
};

export const METHOD_COLORS: Record<HttpMethod, { text: string; dark: string }> = {
  GET:     { text: 'text-blue-600',    dark: 'dark:text-blue-400' },
  POST:    { text: 'text-emerald-600', dark: 'dark:text-emerald-400' },
  PUT:     { text: 'text-orange-500',  dark: 'dark:text-orange-400' },
  PATCH:   { text: 'text-amber-600',   dark: 'dark:text-amber-400' },
  DELETE:  { text: 'text-rose-600',    dark: 'dark:text-rose-400' },
  OPTIONS: { text: 'text-violet-600',  dark: 'dark:text-violet-400' },
  HEAD:    { text: 'text-slate-500',   dark: 'dark:text-slate-400' },
};

export function getStatusClasses(status: number): string {
  if (status >= 500) return 'text-rose-600 dark:text-rose-400';
  if (status >= 400) return 'text-orange-600 dark:text-orange-400';
  if (status >= 300) return 'text-blue-600 dark:text-blue-400';
  if (status >= 200) return 'text-emerald-600 dark:text-emerald-400';
  return 'text-muted-foreground';
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatTime(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
