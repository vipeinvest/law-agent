import type { OrgTheme } from '@/lib/org';
import { themeCss } from '@/lib/org';

export function ThemeStyle({ theme }: { theme: OrgTheme }) {
  return <style dangerouslySetInnerHTML={{ __html: themeCss(theme) }} />;
}

export function BrandMark({ theme, orgName, size = 'md' }: { theme: OrgTheme; orgName: string; size?: 'sm' | 'md' | 'lg' }) {
  const h = size === 'lg' ? 'h-12' : size === 'sm' ? 'h-7' : 'h-9';
  if (theme.logoDataUrl) {
    return <img src={theme.logoDataUrl} alt={orgName} className={`${h} w-auto max-w-[200px] object-contain`} />;
  }
  const text = theme.logoText || theme.appName || orgName;
  return (
    <div className="flex items-center gap-2">
      <span className={`${size === 'lg' ? 'w-12 h-12 text-xl' : size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'} rounded-xl bg-brand text-brand-fg font-black flex items-center justify-center`} aria-hidden>
        {text.slice(0, 1).toUpperCase()}
      </span>
      <span className={`font-bold tracking-tight ${size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg'}`}>{text}</span>
    </div>
  );
}
