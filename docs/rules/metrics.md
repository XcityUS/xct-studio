# Product Metrics And Event Rules

Last updated: 2026-09-07

## Goal

Metrics must describe whether creators can finish short-drama production reliably, not merely whether a generation button was clicked.

Do not add a telemetry vendor or production analytics implementation without an explicit product task. This document defines the event and metric contract first.

## Core Events

Use past-tense, domain-oriented event names:

| Event | Meaning |
| --- | --- |
| ip_created | A new IP container was created. |
| character_version_locked | A character appearance or reference pack was locked for production. |
| episode_created | A production Episode was created. |
| script_breakdown_completed | Script was converted to editable scenes and shots. |
| shot_generation_requested | A Shot submitted one or more candidate generation requests. |
| candidate_generated | A provider result became an available Candidate. |
| candidate_rejected | A candidate was rejected with an optional structured reason. |
| candidate_selected | A candidate became the selected take for a Shot. |
| episode_assembled | Selected takes were assembled into an Episode Version. |
| episode_exported | A final export completed. |
| generation_failed | A provider or integration failure prevented a candidate from completing. |

## Common Event Fields

Events should use a versioned shape and include only safe metadata:

- eventVersion
- occurredAt
- actor or workspace identifier where authorized
- ipId, episodeId, sceneId, shotId, candidateId when applicable
- model and provider class
- requestedDurationMs or producedDurationMs when applicable
- status, errorCode, and retryCount when applicable
- estimatedCost and actualCost when available

Do not send full prompts, raw scripts, private reference URLs, API keys, authorization evidence, or browser file names unless a separately approved privacy policy permits it.

## Primary Product Metrics

| Metric | Definition |
| --- | --- |
| Generation success rate | Completed candidates divided by requested candidates, excluding user-cancelled work. |
| Time to first candidate | Median time from request accepted to first completed candidate for a Shot. |
| Candidate selection rate | Shots with one selected take divided by Shots with at least one completed candidate. |
| Regeneration rate | Candidates requested after a Shot already had a completed candidate, divided by generated candidates. |
| Episode completion rate | Episodes exported divided by Episodes that reached ready-to-generate. |
| Cost per selected second | Generation cost associated with a Shot divided by duration of its selected take. |
| Continuity acceptance rate | Candidates accepted without a continuity-related rejection divided by reviewed candidates. |

## Metric Semantics

- Keep a metric definition stable across releases. If its calculation changes, version the metric and document the change.
- Count a retry as a new generation attempt, but associate it with the same Shot.
- Count only durable completed candidates in completion metrics.
- A selected take is one selected candidate per Shot by default.
- Use UTC event time. Client event time is advisory; server or Worker time should be authoritative once available.

## Operational Metrics

Track these separately from product metrics:

- route and Worker error rate
- provider latency and error rate
- R2 archive success rate
- archive byte volume
- export failure rate
- state-sync conflict rate

Operational alerts must not expose customer prompt or media content.

