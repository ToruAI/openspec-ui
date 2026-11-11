// Renderers that turn compact change descriptions into the artifact markdown
// OpenSpec's spec-driven schema expects (proposal / design / tasks / spec deltas).

const bullets = (items) => items.map((i) => `- ${i}`).join('\n');

export function renderProposal(p) {
  const caps = (list) => (list.length ? list.map(([c, d]) => `- \`${c}\`: ${d}`).join('\n') : '');
  return `# Proposal

## Why

${p.why}

## What Changes

${bullets(p.what)}

## Capabilities

### New Capabilities
${caps(p.newCaps ?? [])}

### Modified Capabilities
${caps(p.modCaps ?? [])}

## Impact

${bullets(p.impact)}
`;
}

export function renderDesign(d) {
  return `# Design

## Context

${d.context}

## Goals / Non-Goals

**Goals:**
${bullets(d.goals)}

**Non-Goals:**
${bullets(d.nonGoals)}

## Decisions

${d.decisions.map(([t, text]) => `**${t}.** ${text}`).join('\n\n')}

## Risks / Trade-offs

${bullets(d.risks)}
`;
}

// groups: { "Group title": ["task", ...] }; done: number of tasks (in order) that are checked, or 'all'
export function renderTasks(groups, done) {
  let n = 0;
  const total = Object.values(groups).flat().length;
  const limit = done === 'all' ? total : (done ?? 0);
  const out = ['# Tasks', ''];
  Object.entries(groups).forEach(([title, tasks], gi) => {
    out.push(`## ${gi + 1}. ${title}`, '');
    tasks.forEach((t, ti) => {
      out.push(`- [${n < limit ? 'x' : ' '}] ${gi + 1}.${ti + 1} ${t}`);
      n++;
    });
    out.push('');
  });
  return out.join('\n');
}

const reqs = (list) =>
  list
    .map(
      ([name, text, scenarios]) => `### Requirement: ${name}
${text}

${scenarios
  .map(([s, when, then]) => `#### Scenario: ${s}\n- **WHEN** ${when}\n- **THEN** ${then}`)
  .join('\n\n')}
`,
    )
    .join('\n');

// spec: { purpose?: string (new capability only), added?: [...], modified?: [...] }
// requirement = [name, text, [[scenario, when, then], ...]]
export function renderSpecDelta(s) {
  const parts = ['# Spec Delta', ''];
  if (s.purpose) parts.push('## Purpose', s.purpose, '');
  if (s.added) parts.push('## ADDED Requirements', '', reqs(s.added));
  if (s.modified) parts.push('## MODIFIED Requirements', '', reqs(s.modified));
  return parts.join('\n');
}

export function renderIdea({ id, createdAt, projectId, title, body }) {
  return `---
id: ${id}
projectId: ${projectId}
createdAt: ${createdAt}
updatedAt: ${createdAt}
---

# ${title}

${body}
`;
}
