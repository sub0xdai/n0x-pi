# The cure for AI slop is a 1986 aircraft manual

This kit contains the STE writing skill, the anti-slop linter, and the full
test data. It needs only Python 3.

## Files

| File | What it is |
|---|---|
| `ste-writing-skill.md` | The ASD-STE100 agent skill. Two modes: strict (procedures, error messages) and flavored (prose, no dictionary lockdown). |
| `ste-lint.py` | The anti-slop linter. It checks the rules of STE that a machine can check. Lint a draft, apply the skill, then lint it again. The delta between the two scores is the signal. |
| `experiment-results.md` | Cross-model test. 6 writing tasks, 4 conditions, run on Claude and gpt-5.5. |
| `experiment-results-openai.md` | Per-category detail for the gpt-5.5 run. |
| `before-after-samples.md` | Real baseline outputs next to STE outputs from the experiment. |
| `run-openai.py` | Script to reproduce the OpenAI side of the experiment. |

## Run the linter

```
python3 ste-lint.py your-draft.md
```

The score is violations per 100 words. A lower score means cleaner text.

## Headline numbers

| Condition | Claude sonnet | gpt-5.5 |
|---|---|---|
| baseline | 4.36 | 3.54 |
| banned-words list | 4.21 (-3%) | 2.14 (-40%) |
| Orwell's 6 rules | 2.48 (-43%) | 1.69 (-52%) |
| STE skill | 1.12 (-74%) | 1.76 (-50%) |

Give the model a writing system and slop drops by half or more. This held on
every model tested. STE was best or tied for best. A banned-words list is the
least reliable fix.

This linter is not a certified STE checker. The judgment rules of ASD-STE100
need a human. The linter covers the rules a machine can check. That is where
the slop lives.

Spec: ASD-STE100 Issue 9, free at asd-ste100.org
