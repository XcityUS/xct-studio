'use client';

import type { EditorDraft } from '../draft';
import styles from './index.module.scss';
import { reviewStoryboard } from '@/features/script/review/storyboard';
import type { StoryboardFinding } from '@/features/script/review/types';
import { useTranslations } from 'next-intl';
import * as React from 'react';

type Props = {
    draft: EditorDraft;
    minDurationSeconds: number;
    maxDurationSeconds: number;
};

function FindingMessage({ finding }: { finding: StoryboardFinding }) {
    const t = useTranslations();
    switch (finding.code) {
        case 'MISSING_DESCRIPTION':
            return t('Add a visible action or shot description');
        case 'INVALID_DURATION':
            return t('Shot duration must be a whole number from <lcur>min<rcur> to <lcur>max<rcur> seconds', {
                min: finding.details?.min ?? 0,
                max: finding.details?.max ?? 0
            });
        case 'DIALOGUE_TOO_LONG':
            return t('Dialogue needs about <lcur>required<rcur> seconds<comma> but this shot has <lcur>available<rcur>', {
                required: finding.details?.required ?? 0,
                available: finding.details?.available ?? 0
            });
        case 'UNKNOWN_DIALOGUE_SPEAKER':
            return t('Choose a valid character for every dialogue speaker');
        case 'UNKNOWN_CHARACTER_REFERENCE':
            return t('This shot references a character that is not in the character list');
        case 'UNKNOWN_SCENE_REFERENCE':
            return t('This shot references a scene that is not in the scene list');
        case 'INVALID_CONTINUITY_SOURCE':
            return t('Continuity must reference an earlier shot');
        case 'UNBOUND_CHARACTER_ASSET':
            return t('Bind a character asset before production');
        case 'UNBOUND_SCENE_ASSET':
            return t('Bind a scene asset before production');
        case 'ABSTRACT_VISUAL_DESCRIPTION':
            return t('Replace the abstract feeling with an action<comma> expression or visible detail');
        case 'HIGH_CAST_COMPLEXITY':
            return t('This shot contains <lcur>count<rcur> characters and may be difficult to generate consistently', {
                count: finding.details?.count ?? 0
            });
    }
}

export function ReviewFindingsPanel({ draft, minDurationSeconds, maxDurationSeconds }: Props) {
    const t = useTranslations();
    const findings = React.useMemo(
        () => reviewStoryboard({ draft, minDurationSeconds, maxDurationSeconds }),
        [draft, maxDurationSeconds, minDurationSeconds]
    );
    const blocking = findings.filter((finding) => finding.severity === 'blocking').length;
    const warnings = findings.length - blocking;

    return (
        <section className={styles.panel} aria-label={t('Storyboard review')}>
            <div className={styles.header}>
                <div>
                    <strong>{t('Storyboard review')}</strong>
                    <p>{t('Checks dialogue timing<comma> references<comma> continuity and visual clarity')}</p>
                </div>
                <span data-clear={findings.length === 0}>
                    {findings.length === 0
                        ? t('No deterministic blocking issues')
                        : t('<lcur>blocking<rcur> blocking<dot> <lcur>warnings<rcur> warnings', { blocking, warnings })}
                </span>
            </div>
            {findings.length > 0 && (
                <ol className={styles.findings}>
                    {findings.map((finding) => (
                        <li key={finding.id} data-severity={finding.severity}>
                            <div>
                                <span>
                                    {finding.targetType === 'character'
                                        ? t('Character <lcur>name<rcur>', { name: finding.targetLabel ?? '' })
                                        : finding.targetType === 'scene'
                                          ? t('Scene <lcur>name<rcur>', { name: finding.targetLabel ?? '' })
                                          : t('Shot <lcur>number<rcur>', { number: finding.shotIndex + 1 })}
                                </span>
                                <em>{finding.severity === 'blocking' ? t('Blocking') : t('Warning')}</em>
                            </div>
                            <p>
                                <FindingMessage finding={finding} />
                            </p>
                            {finding.evidence && <blockquote>{finding.evidence}</blockquote>}
                        </li>
                    ))}
                </ol>
            )}
        </section>
    );
}
