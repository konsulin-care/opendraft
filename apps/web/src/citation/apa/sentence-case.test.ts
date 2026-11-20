import { describe, expect, it } from 'vitest';
import { sentenceCase } from './sentence-case';

describe('sentenceCase', () => {
  it('lowercases words and capitalizes after a colon', () => {
    expect(sentenceCase("Young People's Data Governance: A Study")).toBe(
      "Young people's data governance: A study",
    );
  });

  it('keeps protected groups, all-caps and mixed-case words as written', () => {
    expect(
      sentenceCase(
        'A Study of {India}, {South Africa}, DNA, mRNA and iPhone in Health',
      ),
    ).toBe('A study of India, South Africa, DNA, mRNA and iPhone in health');
  });

  it('formats the MindKind title', () => {
    expect(
      sentenceCase(
        "Young People's Data Governance Preferences for Their Mental Health Data: {MindKind} Study Findings from {India}, {South Africa} and the {United Kingdom}",
      ),
    ).toBe(
      "Young people's data governance preferences for their mental health data: MindKind study findings from India, South Africa and the United Kingdom",
    );
  });
});
