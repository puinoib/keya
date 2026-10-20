import { cn } from '@/lib/utils';
import {
  getProviderLogo,
  isMonochromeProviderLogo,
} from '@/app/lib/provider-logo';

export function ProviderLogo({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}) {
  const logo = getProviderLogo(provider);
  if (!logo) return null;

  return (
    <img
      src={logo}
      alt=""
      className={cn(
        'shrink-0',
        className,
        isMonochromeProviderLogo(provider) && 'provider-logo-mono'
      )}
    />
  );
}
