---
name: cover-letter
description: >
  Write a job application cover letter from a pasted job posting, grounded in the
  user's real resume and past cover letters. Triggers on "make me a cover letter",
  "write a cover letter for this role", "help me apply to <job>", or a pasted job
  posting with a request for application material.
allowed-tools: ls, read, bash, ask_user, write, edit
---

# Cover Letter Writing

Produce a markdown cover letter for a specific job posting, written in the
user's established voice, matching their real experience. The letter must never
invent qualifications the user does not have.

## Phase 1 - Parse the posting

Extract from the user's message: role title, company, location, employment type,
requirements (must-haves and nice-to-haves), and any keywords the posting
repeats. Keep this list - the letter maps to it.

## Phase 2 - Inventory the career directory

`ls` the career directory (e.g. `~/2-areas/career-management/`). Identify:

1. The resume source of truth (`.md` preferred; `.docx`/`.pdf` need extraction).
2. Two or three past cover letters - these are the format and voice references.

Read the past cover letters fully. Note the house format: contact header,
company block, `Re:` line, salutation, 3-5 paragraph body, closing.

## Phase 3 - Extract resume text

- `.md`: read directly.
- `.docx`: `pandoc -t plain file.docx`.
- `.pdf`: `pdftotext file.pdf -` or `pandoc`.

Read the full resume. Flag what the user actually did (titles, employers, dates)
so the letter never claims otherwise.

## Phase 4 - Skill match

`grep` the resume and past letters for each requirement keyword from the
posting. Build the evidence list: which posting requirements the resume proves,
and which are gaps the letter must handle honestly (e.g. reframe adjacent
experience, or state transferable skills).

## Phase 5 - Ask preference questions

`ask_user` with 2-3 targeted questions, grounded in the posting and the
resume. Typical questions:

1. Tone: professional vs. energetic/casual (match company vibe).
2. Experience framing: lead with strongest relevant experience, or address a
   gap (no experience / career change) explicitly.
3. Special extras the posting mentions (e.g. license, gym membership perk,
   certification) - mention or skip.

Do not ask generic questions. Each question must come from something real in
the posting or resume.

## Phase 6 - Write the letter

Write `cover-letter-<company>.md` in the career directory, following the house
format from Phase 2:

1. Header: name, phone, email, location.
2. Company block + `Re:` line naming the exact role.
3. Opening paragraph: the role and why it fits.
4. Body: 2-3 paragraphs, each one requirement keyword mapped to real evidence
   from the resume, phrased in the user's voice from past letters.
5. Closing: call to action + sign-off.

Keep paragraphs short (3-5 sentences). Never use em dashes. Banned words:
delve, landscape, tapestry, robust, seam, seamless, cutting-edge,
transformative, pioneering, leverage, ultimately, moreover, furthermore.

## Phase 7 - Quality gates

Run the emission check on a `.tmp` copy and fix violations:

```bash
cp cover-letter-<company>.md /tmp/letter.md && bash ~/dotfiles/scripts/__check.sh /tmp/letter.md
```

Fix: lines over 100 chars, banned words, em dashes, rule-of-three phrasing.
Write the clean version.

## Phase 8 - Iterate

Report the letter's angle (which requirements it leans on, how it handles
gaps). Offer to adjust. When the user gives corrections, apply them with
`edit` for small changes or a full rewrite when the framing changes - rewrite
the whole letter rather than patching around a wrong framing.

## Verification

- Every claim in the letter traces to the resume or the user's stated corrections.
- No invented employers, titles, or dates.
- The letter names the exact role and company from the posting.
