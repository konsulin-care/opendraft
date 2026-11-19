/** A single validation finding. */
export interface Finding {
  level: 'error' | 'warning' | 'info';
  /** Stage or area that produced the finding (e.g. 'project'). */
  location: string;
  /** File or field path the finding refers to. */
  path: string;
  message: string;
}

/** Options for validateProject. */
export interface ValidateOptions {
  release?: boolean;
  offline?: boolean;
  protocol?: string;
  sourceRevision?: string;
}
