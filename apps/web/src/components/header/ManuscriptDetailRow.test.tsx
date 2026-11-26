// @vitest-environment jsdom
/**
 * ManuscriptDetailRow tests: the row is editable when a rename handler is
 * given, read-only otherwise, and carries the Choose manuscript button that
 * opens the picker when a handler is supplied.
 */
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ManuscriptDetailRow } from './ManuscriptDetailRow';
import { DetailList } from './detail-list';

describe('ManuscriptDetailRow', () => {
  it('saves the trimmed name on Enter when a rename handler is given', () => {
    const onRename = vi.fn();
    render(
      <DetailList>
        <ManuscriptDetailRow name="Alpha study" onRename={onRename} />
      </DetailList>,
    );

    const field = screen.getByRole('textbox', { name: 'Manuscript name' });
    fireEvent.change(field, { target: { value: '  Beta study  ' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('Beta study');
  });

  it('renders plain read-only text and no input without a rename handler', () => {
    render(
      <DetailList>
        <ManuscriptDetailRow name="Alpha study" />
      </DetailList>,
    );

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Alpha study').tagName).toBe('SPAN');
  });

  it('calls the picker handler from Choose manuscript and exposes the ref', () => {
    const onOpenPicker = vi.fn();
    const switchRef = createRef<HTMLButtonElement>();
    render(
      <DetailList>
        <ManuscriptDetailRow name="Alpha study" onOpenPicker={onOpenPicker} switchRef={switchRef} />
      </DetailList>,
    );

    const button = screen.getByRole('button', { name: 'Choose manuscript' });
    expect(switchRef.current).toBe(button);
    fireEvent.click(button);
    expect(onOpenPicker).toHaveBeenCalledTimes(1);
  });
});
