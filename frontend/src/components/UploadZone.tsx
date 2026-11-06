import { useRef, useState } from 'react';
import { FileArchive, FileCode2, Trash2, UploadCloud } from 'lucide-react';
import clsx from 'clsx';
import { formatBytes } from '../lib/format';

interface Props {
  file: File | null;
  onFile: (f: File | null) => void;
  maxMb: number;
  error?: string | null;
}

export default function UploadZone({ file, onFile, maxMb, error }: Props) {
  const [dragging, setDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function accept(f: File | null | undefined) {
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!name.endsWith('.html') && !name.endsWith('.htm') && !name.endsWith('.zip')) {
      setLocalError('Only .html or .zip files are supported');
      return;
    }
    if (f.size > maxMb * 1024 * 1024) {
      setLocalError(`File is ${formatBytes(f.size)} — max ${maxMb}MB on this deployment`);
      return;
    }
    setLocalError(null);
    onFile(f);
  }

  const shown = error || localError;

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
        className={clsx(
          'cursor-pointer rounded-2xl border-2 border-dashed p-8 md:p-12 text-center transition-all',
          dragging ? 'border-brand-400 bg-brand-500/10 scale-[1.01]' : 'border-white/15 hover:border-brand-400/50 hover:bg-white/[0.03]'
        )}
      >
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-brand-500/25 to-accent/25 border border-white/10 flex items-center justify-center mb-4">
          <UploadCloud className="w-7 h-7 text-brand-300" />
        </div>
        <p className="font-semibold text-white">Drag & drop your website here</p>
        <p className="text-sm text-slate-400 mt-1">
          a single <span className="text-brand-300 font-medium">index.html</span> or a{' '}
          <span className="text-brand-300 font-medium">.zip</span> project — up to {maxMb}MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,.zip"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>

      {shown && <p className="text-sm text-red-300 mt-3">{shown}</p>}

      {file && (
        <div className="glass flex items-center gap-3 p-4 mt-4">
          {file.name.toLowerCase().endsWith('.zip') ? (
            <FileArchive className="w-8 h-8 text-accent shrink-0" />
          ) : (
            <FileCode2 className="w-8 h-8 text-brand-300 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-white text-sm truncate">{file.name}</p>
            <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
          </div>
          <button className="btn-ghost !p-2" aria-label="Remove file" onClick={() => onFile(null)}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
