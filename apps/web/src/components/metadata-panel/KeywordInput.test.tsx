// @vitest-environment jsdom
/**
 * KeywordInput tests: the 'Add keyword' reveal button, chip creation
 * with Enter and comma, paste splitting, duplicate skipping,
 * Backspace removal and the count.
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

/** Click the 'Add keyword' button that reveals the input when empty. */
function revealKeywordInput(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Add keyword' }));
}

describe('KeywordInput reveal', () => {
  it('with no keywords shows only an Add keyword button and no input', () => {
    render(<Harness />);
    expect(screen.queryByTestId('keyword-field')).toBeNull();
    expect(screen.getByTestId('keyword-input').querySelectorAll('input')).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Add keyword' }).tagName).toBe('BUTTON');
  });

  it("clicking 'Add keyword' reveals a focused input with no placeholder", () => {
    render(<Harness />);
    revealKeywordInput();
    const input = screen.getByTestId('keyword-field') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.hasAttribute('placeholder')).toBe(false);
  });
});

describe('KeywordInput chips', () => {
  it("adds a chip when 'fasting' is entered with Enter", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    revealKeywordInput();
    const input = screen.getByTestId('keyword-field');
    fireEvent.change(input, { target: { value: 'fasting' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['fasting']);
    expect(screen.getByTestId('keyword-chip').textContent).toBe('fasting');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('adds a chip when a comma is typed', () => {
    render(<Harness />);
    revealKeywordInput();
    const input = screen.getByTestId('keyword-field');
    fireEvent.change(input, { target: { value: 'keto' } });
    fireEvent.keyDown(input, { key: ',' });
    expect(screen.getByTestId('keyword-chip').textContent).toBe('keto');
  });

  it("splits a paste of 'a, b; c' into three chips", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    revealKeywordInput();
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
