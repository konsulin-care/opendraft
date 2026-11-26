import { describe, it, expect } from 'vitest';
import { surfaceClasses, Z_SCRIM, Z_SURFACE } from './surface-styles';

const classes = (spaced: string): string[] => spaced.split(' ').filter(Boolean);

const expectTopSheet = (): void => {
  const { root, body } = surfaceClasses({ variant: 'top-sheet' });
  expect(classes(root)).toEqual(
    expect.arrayContaining([
      'absolute',
      'inset-x-0',
      'top-full',
      'border-b',
      'border-gray-200',
      'shadow-md',
      'starting:-translate-y-2',
    ]),
  );
  expect(body).toBe('');
};

const expectBottomSheet = (): void => {
  const { root } = surfaceClasses({ variant: 'bottom-sheet' });
  expect(classes(root)).toEqual(
    expect.arrayContaining([
      'fixed',
      'inset-x-0',
      'bottom-0',
      'rounded-t-2xl',
      'border-t',
      'border-gray-200',
      'shadow-xl',
      'starting:translate-y-full',
    ]),
  );
};

const expectMdPopover = (): void => {
  const { root } = surfaceClasses({
    variant: 'bottom-sheet',
    mdVariant: 'popover',
  });
  expect(classes(root)).toEqual(
    expect.arrayContaining([
      'md:absolute',
      'md:bottom-auto',
      'md:top-full',
      'md:left-14',
      'md:right-auto',
      'md:w-80',
      'md:rounded-md',
      'md:border',
      'md:shadow-lg',
      'md:starting:-translate-y-1',
    ]),
  );
};

const expectMaxHeight = (): void => {
  const { root, body } = surfaceClasses({
    variant: 'popover',
    maxHeight: '80vh',
  });
  expect(classes(root)).toEqual(
    expect.arrayContaining(['flex', 'max-h-[80vh]', 'flex-col']),
  );
  expect(body).toBe('min-h-0 overflow-y-auto');
};

const expectBase = (): void => {
  const { root } = surfaceClasses({ variant: 'popover' });
  expect(classes(root)).toEqual(
    expect.arrayContaining([
      'z-30',
      'bg-white',
      'text-left',
      'transition',
      'duration-150',
      'starting:opacity-0',
      'motion-reduce:transition-none',
      'absolute',
      'left-0',
      'top-full',
      'w-80',
      'rounded-md',
      'border',
      'border-gray-200',
      'shadow-lg',
    ]),
  );
};

describe('surface-styles', () => {
  it('exposes the shared stacking constants', () => {
    expect(Z_SCRIM).toBe('z-20');
    expect(Z_SURFACE).toBe('z-30');
  });

  it('anchors a top-sheet full width under its container and starts translated up', expectTopSheet);

  it('fixes a bottom-sheet to the viewport bottom with rounded top corners', expectBottomSheet);

  it('applies the md popover overrides that anchor a w-80 card under the title', expectMdPopover);

  it('caps the root at 80vh and returns a scrollable body when maxHeight is set', expectMaxHeight);

  it('returns an empty body class without maxHeight', () => {
    const { body } = surfaceClasses({ variant: 'popover' });
    expect(body).toBe('');
  });

  it('always includes the popover base styling', expectBase);
});
