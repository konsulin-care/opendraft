// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DoiInput } from './doi-input';

describe('DoiInput', () => {
  it('renders input with placeholder', () => {
    const onResolve = vi.fn();
    const onEscape = vi.fn();
    render(<DoiInput doi="" onDoiChange={() => {}} onResolve={onResolve} onEscape={onEscape} />);

    expect(screen.getByPlaceholderText(/Enter DOI/)).toBeDefined();
  });

  it('calls onResolve when Enter is pressed', () => {
    const onResolve = vi.fn();
    const onEscape = vi.fn();
    render(<DoiInput doi="10.1234/test" onDoiChange={() => {}} onResolve={onResolve} onEscape={onEscape} />);

    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: 'Enter' });
    expect(onResolve).toHaveBeenCalledWith('10.1234/test');
  });

  it('calls onEscape when Escape is pressed', () => {
    const onResolve = vi.fn();
    const onEscape = vi.fn();
    render(<DoiInput doi="" onDoiChange={() => {}} onResolve={onResolve} onEscape={onEscape} />);

    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalled();
  });

  it('calls onEscape when Backspace on empty input', () => {
    const onResolve = vi.fn();
    const onEscape = vi.fn();
    render(<DoiInput doi="" onDoiChange={() => {}} onResolve={onResolve} onEscape={onEscape} />);

    fireEvent.keyDown(screen.getByPlaceholderText(/Enter DOI/), { key: 'Backspace' });
    expect(onEscape).toHaveBeenCalled();
  });
});
