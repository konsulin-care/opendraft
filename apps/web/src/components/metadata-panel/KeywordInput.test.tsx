// @vitest-environment jsdom
/**
 * KeywordInput tests: chip creation with Enter and comma, paste
 * splitting, duplicate skipping, Backspace removal and the count.
 */
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeywordInput } from './KeywordInput';

/** Props of the stateful harness used to keep chips in sync. */
interface HarnessProps {
  /** Initial keyword list. */
  initial?: string[];
  /** Spy receiving every deduped array passed to onChange. */
  onChange?: (keywords: string[]) => void;
}

/**
 * Stateful wrapper so chip rendering follows the controlled value.
 *
 * @param props - See {@link HarnessProps}.
 * @returns The wired KeywordInput.
 */
function Harness({ initial = [], onChange }: HarnessProps): ReactNode {
  const [keywords, setKeywords] = useState(initial);
  return (
    <KeywordInput
      keywords={keywords}
      onChange={(next) => {
        setKeywords(next);
        onChange?.(next);
      }}
    />
  );
}

describe('KeywordInput chips', () => {
  it("adds a chip when 'fasting' is entered with Enter", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByTestId('keyword-field');
    fireEvent.change(input, { target: { value: 'fasting' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['fasting']);
    expect(screen.getByTestId('keyword-chip').textContent).toBe('fasting');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('adds a chip when a comma is typed', () => {
    render(<Harness />);
    const input = screen.getByTestId('keyword-field');
    fireEvent.change(input, { target: { value: 'keto' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(screen.getByTestId('keyword-chip').textContent).toBe('keto');
  });

  it("splits a paste of 'a, b; c' into three chips", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.paste(screen.getByTestId('keyword-field'), {
      clipboardData: { getData: () => 'a, b; c' },
    });
    expect(onChange).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(screen.getAllByTestId('keyword-chip').map((chip) => chip.textContent))
      .toEqual(['a', 'b', 'c']);
  });
});

describe('KeywordInput removal and dedupe', () => {
  it('ignores a duplicate keyword', () => {
    const onChange = vi.fn();
    render(<Harness initial={['a']} onChange={onChange} />);
    const input = screen.getByTestId('keyword-field');
    fireEvent.change(input, { target: { value: 'a' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getAllByTestId('keyword-chip')).toHaveLength(1);
  });

  it('removes the last chip on Backspace in an empty input', () => {
    const onChange = vi.fn();
    render(<Harness initial={['a', 'b']} onChange={onChange} />);
    fireEvent.keyDown(screen.getByTestId('keyword-field'), { key: 'Backspace' });
    expect(onChange).toHaveBeenCalledWith(['a']);
  });

  it('passes a deduped array to onChange when pasting over existing chips', () => {
    const onChange = vi.fn();
    render(<Harness initial={['a']} onChange={onChange} />);
    fireEvent.paste(screen.getByTestId('keyword-field'), {
      clipboardData: { getData: () => 'a, b; c' },
    });
    expect(onChange).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('shows the chip count', () => {
    render(<Harness initial={['a', 'b']} />);
    expect(screen.getByTestId('keyword-count').textContent).toBe('2 keywords');
  });
});
