import { useState } from 'react';
import type { WorkspaceAdapter } from '@opendraft/workspace';
import { preCommitAssembly } from '@opendraft/git';

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
    const result = await preCommitAssembly(workspace);
    if (result.success) {
      onCommit(message);
      setMessage('');
      onClose();
    } else {
      setErrors(result.errors);
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
