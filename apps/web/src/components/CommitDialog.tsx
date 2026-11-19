import { useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { validateProject } from '@opendraft/validate';
import { IndexedDbProtocolCache } from '../project/protocol-cache';

interface CommitDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCommit: (message: string) => void;
  workspace: WorkspaceAdapter;
}

interface ErrorListProps {
  errors: string[];
}

function ErrorList({ errors }: ErrorListProps) {
  if (errors.length === 0) return null;
  return (
    <div className="commit-errors">
      <p>Validation errors:</p>
      <ul>
        {errors.map((error, i) => (
          <li key={i}>{error}</li>
        ))}
      </ul>
    </div>
  );
}

interface CommitActionsProps {
  isCompiling: boolean;
  message: string;
  onClose: () => void;
  onCommit: () => void;
}

function CommitActions({ isCompiling, message, onClose, onCommit }: CommitActionsProps) {
  return (
    <div className="commit-actions">
      <button onClick={onClose} disabled={isCompiling}>Cancel</button>
      <button onClick={onCommit} disabled={isCompiling || !message.trim()}>
        {isCompiling ? 'Compiling...' : 'Commit'}
      </button>
    </div>
  );
}

/**
 * Modal dialog for committing changes.
 *
 * Runs the assembly-first pre-commit validation before committing.
 */
export function CommitDialog({ isOpen, onClose, onCommit, workspace }: CommitDialogProps) {
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [isCompiling, setIsCompiling] = useState(false);

  if (!isOpen) return null;

  const handleCommit = async () => {
    setIsCompiling(true);
    setErrors([]);
    const findings = await validateProject(workspace, {
      cache: new IndexedDbProtocolCache(),
      fetch: (url: string) => fetch(url),
    } as Parameters<typeof validateProject>[1]);
    const blocking = findings.filter((f) => f.level === 'error');
    if (blocking.length === 0) {
      onCommit(message);
      setMessage('');
      onClose();
    } else {
      setErrors(blocking.map((f) => `${f.path}: ${f.message}`));
    }
    setIsCompiling(false);
  };

  return (
    <div className="commit-dialog-overlay">
      <div className="commit-dialog">
        <h2>Commit Changes</h2>
        <ErrorList errors={errors} />
        <textarea placeholder="Enter commit message..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
        <CommitActions isCompiling={isCompiling} message={message} onClose={onClose} onCommit={handleCommit} />
      </div>
    </div>
  );
}
