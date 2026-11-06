import { StepDot } from './ui';
import { ProgressBar } from './ui';
import type { StepInfo } from '../lib/types';
import clsx from 'clsx';

/** Renders the real 13-step pipeline state coming from GitHub Actions. */
export default function StepProgress({ steps, progress, currentStep }: { steps: StepInfo[]; progress: number; currentStep: number }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-400 font-medium">
          {currentStep > 0 ? `Step ${currentStep} of ${steps.length}` : 'Waiting for the runner…'}
        </span>
        <span className="font-bold text-white tabular-nums">{progress}%</span>
      </div>
      <ProgressBar value={progress} />
      <ol className="space-y-1.5 mt-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition',
              step.status === 'running' && 'bg-brand-500/10 border border-brand-400/25',
              step.status === 'pending' && 'opacity-55',
              step.status === 'failed' && 'bg-red-500/10 border border-red-400/25',
              step.status === 'done' && 'border border-transparent'
            )}
          >
            <StepDot status={step.status} />
            <span className={clsx('font-medium', step.status === 'pending' ? 'text-slate-500' : 'text-slate-200')}>
              <span className="text-slate-500 mr-1.5 tabular-nums">{step.id}.</span>
              {step.name}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
