/**
 * The password strength meter shared by the unlock, create and change-password
 * dialogs: five segments, the score as a word, and the sentence that explains a
 * refusal. The policy itself lives in `lib/password-policy`; this only draws it.
 */

import {
  describePasswordVerdict,
  type PasswordVerdict,
} from '@/app/lib/password-policy';

const SEGMENTS = [0, 1, 2, 3, 4];

const STRENGTH = {
  0: { label: 'Very Weak', color: 'bg-red-500' },
  1: { label: 'Weak', color: 'bg-red-500' },
  2: { label: 'Fair', color: 'bg-orange-500' },
  3: { label: 'Good', color: 'bg-yellow-500' },
  4: { label: 'Strong', color: 'bg-emerald-500' },
} as const;

export function PasswordStrengthMeter({
  verdict,
}: {
  verdict: PasswordVerdict | null;
}) {
  const estimate = verdict?.estimate ?? null;
  if (!verdict) return null;

  const score = estimate?.score ?? 0;
  const strength =
    estimate !== null ? STRENGTH[score as keyof typeof STRENGTH] : STRENGTH[0];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {SEGMENTS.map((segment) => (
            <div
              key={segment}
              className={`h-1 flex-1 rounded-full transition-colors ${
                estimate && segment <= score ? strength.color : 'bg-surface-3'
              }`}
            />
          ))}
        </div>
        {estimate && (
          <span className="text-xs text-ink-quaternary">{strength.label}</span>
        )}
      </div>
      {!verdict.ok && (
        <p className="text-xs text-danger">
          {describePasswordVerdict(verdict)}
        </p>
      )}
      {estimate?.feedback.warning && (
        <p className="text-xs text-danger">{estimate.feedback.warning}</p>
      )}
      {estimate?.feedback.suggestions &&
        estimate.feedback.suggestions.length > 0 && (
          <p className="text-xs text-ink-quaternary">
            {estimate.feedback.suggestions[0]}
          </p>
        )}
    </div>
  );
}
