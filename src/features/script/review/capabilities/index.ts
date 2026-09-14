import type { ScreenwritingCapability, ScreenwritingStage } from '../types';
import { INKOS_CAPABILITIES } from './inkos';
import { SCREENWRITING_CAPABILITIES } from './screenwriting';

export const SCREENWRITING_CAPABILITY_CATALOG: ScreenwritingCapability[] = [
    ...SCREENWRITING_CAPABILITIES,
    ...INKOS_CAPABILITIES
];

export function routedCapabilities(stage: ScreenwritingStage, enabledIds: string[] = []): ScreenwritingCapability[] {
    const enabled = new Set(enabledIds);
    return SCREENWRITING_CAPABILITY_CATALOG.filter(
        (item) =>
            item.role !== 'overlap' && item.stages.includes(stage) && (item.defaultEnabled || enabled.has(item.id))
    );
}

export function capabilityById(id: string): ScreenwritingCapability | undefined {
    return SCREENWRITING_CAPABILITY_CATALOG.find((item) => item.id === id);
}
