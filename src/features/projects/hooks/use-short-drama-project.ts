'use client';

import {
    createCharacterVersion,
    createProject,
    createProjectAsset,
    readProjectState,
    writeProjectState
} from '../storage';
import type {
    ProductionSnapshot,
    ProjectAsset,
    ProjectAssetKind,
    ProjectAssetSourceType,
    ProjectAssetStatus,
    ProjectState,
    ShortDramaProject,
    ShotAssetBinding
} from '@/shared/contracts/production';
import type { ReferenceOrigin } from '@/features/assets/reference/origin';
import type { UserAsset } from '@/lib/media-archive';
import * as React from 'react';

type RegisterAssetInput = {
    name: string;
    kind: ProjectAssetKind;
    sourceType: ProjectAssetSourceType;
    status?: ProjectAssetStatus;
    mediaKey?: string;
    sourceUrl?: string;
    providerReferenceUrl?: string;
    providerAssetId?: string;
    origin?: ReferenceOrigin;
    note?: string;
};

function displayNameFromAsset(asset: UserAsset): string {
    return asset.name?.trim() || asset.key.split('/').pop() || asset.key || 'Project asset';
}

function kindFromUserAsset(asset: UserAsset): ProjectAssetKind {
    if (asset.kind === 'audio') return 'audio';
    if (asset.kind === 'video') return 'video';
    if (asset.kind === 'image') return 'image';
    return 'other';
}

function sourceTypeFromAsset(asset: UserAsset): ProjectAssetSourceType {
    return asset.key.startsWith('video_') ? 'generated' : 'upload';
}

function referenceUrlForAsset(asset: ProjectAsset): string | undefined {
    return asset.providerReferenceUrl || asset.sourceUrl;
}

function bindingForAsset(asset: ProjectAsset): ShotAssetBinding | null {
    const referenceUrl = referenceUrlForAsset(asset);
    if (!referenceUrl) return null;
    return {
        projectAssetId: asset.id,
        role: asset.kind,
        label: asset.name,
        referenceUrl,
        providerAssetId: asset.providerAssetId
    };
}

export function useShortDramaProject() {
    const [state, setState] = React.useState<ProjectState>(() => readProjectState());

    React.useEffect(() => {
        writeProjectState(state);
    }, [state]);

    const activeProject = React.useMemo(
        () => state.projects.find((project) => project.id === state.activeProjectId) ?? state.projects[0],
        [state.activeProjectId, state.projects]
    );

    const projectAssets = React.useMemo(
        () => state.assets.filter((asset) => asset.projectId === activeProject.id && asset.status !== 'archived'),
        [activeProject.id, state.assets]
    );

    const characterVersions = React.useMemo(
        () => state.characterVersions.filter((version) => version.projectId === activeProject.id),
        [activeProject.id, state.characterVersions]
    );

    const addProject = React.useCallback((title: string) => {
        const project = createProject(title, state.projects.map((item) => item.title));
        setState((current) => ({
            ...current,
            activeProjectId: project.id,
            projects: [...current.projects, project]
        }));
    }, [state.projects]);

    const setActiveProjectId = React.useCallback((projectId: string) => {
        setState((current) =>
            current.projects.some((project) => project.id === projectId)
                ? { ...current, activeProjectId: projectId }
                : current
        );
    }, []);

    const deleteProject = React.useCallback((projectId: string) => {
        setState((current) => {
            if (current.projects.length <= 1) return current;
            const projects = current.projects.filter((project) => project.id !== projectId);
            if (projects.length === current.projects.length) return current;
            return {
                ...current,
                activeProjectId: current.activeProjectId === projectId ? projects[0].id : current.activeProjectId,
                projects,
                assets: current.assets.filter((asset) => asset.projectId !== projectId),
                characterVersions: current.characterVersions.filter((version) => version.projectId !== projectId)
            };
        });
    }, []);

    const updateActiveProject = React.useCallback((patch: Partial<Pick<ShortDramaProject, 'title' | 'styleNote'>>) => {
        setState((current) => ({
            ...current,
            projects: current.projects.map((project) =>
                project.id === current.activeProjectId ? { ...project, ...patch, updatedAt: Date.now() } : project
            )
        }));
    }, []);

    const registerProjectAsset = React.useCallback(
        (input: RegisterAssetInput): ProjectAsset => {
            const providerReferenceUrl = input.providerReferenceUrl?.trim();
            const providerAssetId =
                input.providerAssetId?.trim() ||
                (providerReferenceUrl?.startsWith('asset://') ? providerReferenceUrl.slice('asset://'.length) : undefined);
            const sourceUrl = input.sourceUrl?.trim();
            const existing = state.assets.find(
                (asset) =>
                    asset.projectId === activeProject.id &&
                    ((providerAssetId && asset.providerAssetId === providerAssetId) ||
                        (sourceUrl && asset.sourceUrl === sourceUrl) ||
                        (input.mediaKey && asset.mediaKey === input.mediaKey))
            );
            const nextAsset = existing
                ? {
                      ...existing,
                      ...input,
                      status: input.status ?? existing.status,
                      providerReferenceUrl: providerReferenceUrl || existing.providerReferenceUrl,
                      providerAssetId: providerAssetId || existing.providerAssetId,
                      sourceUrl: sourceUrl || existing.sourceUrl,
                      updatedAt: Date.now()
                  }
                : createProjectAsset({
                      projectId: activeProject.id,
                      name: input.name.trim() || 'Project asset',
                      kind: input.kind,
                      status: input.status ?? 'uploaded',
                      sourceType: input.sourceType,
                      mediaKey: input.mediaKey,
                      sourceUrl,
                      providerReferenceUrl,
                      providerAssetId,
                      origin: input.origin,
                      note: input.note,
                      tags: []
                  });
            setState((current) => ({
                ...current,
                assets: existing
                    ? current.assets.map((asset) => (asset.id === nextAsset.id ? nextAsset : asset))
                    : [...current.assets, nextAsset]
            }));
            return nextAsset;
        },
        [activeProject.id, state.assets]
    );

    const attachUserAsset = React.useCallback(
        (asset: UserAsset, providerReferenceUrl?: string): ProjectAsset =>
            registerProjectAsset({
                name: displayNameFromAsset(asset),
                kind: kindFromUserAsset(asset),
                sourceType: sourceTypeFromAsset(asset),
                status: providerReferenceUrl?.startsWith('asset://') ? 'active' : 'uploaded',
                mediaKey: asset.key,
                sourceUrl: asset.url,
                providerReferenceUrl
            }),
        [registerProjectAsset]
    );

    const updateProjectAssetKind = React.useCallback((assetId: string, kind: ProjectAssetKind) => {
        setState((current) => ({
            ...current,
            assets: current.assets.map((asset) =>
                asset.id === assetId ? { ...asset, kind, updatedAt: Date.now() } : asset
            )
        }));
    }, []);

    const archiveProjectAsset = React.useCallback((assetId: string) => {
        setState((current) => ({
            ...current,
            assets: current.assets.map((asset) =>
                asset.id === assetId ? { ...asset, status: 'archived', updatedAt: Date.now() } : asset
            ),
            characterVersions: current.characterVersions.map((version) => ({
                ...version,
                referenceAssetIds: version.referenceAssetIds.filter((id) => id !== assetId),
                updatedAt: Date.now()
            }))
        }));
    }, []);

    const createCharacterReferencePack = React.useCallback((name: string, assetIds: string[], providerGroupId?: string) => {
        const version = createCharacterVersion({
            projectId: activeProject.id,
            name: name.trim() || 'Character',
            providerGroupId,
            referenceAssetIds: assetIds
        });
        setState((current) => ({ ...current, characterVersions: [...current.characterVersions, version] }));
    }, [activeProject.id]);

    const buildProductionSnapshot = React.useCallback(
        (shot?: { id: string; index: number; count: number; durationSeconds: number }): ProductionSnapshot => ({
            version: 1,
            source: 'local-draft',
            project: activeProject,
            shot,
            assetBindings: projectAssets
                .filter((asset) => asset.status === 'active' || asset.status === 'uploaded')
                .map(bindingForAsset)
                .filter((binding): binding is ShotAssetBinding => Boolean(binding)),
            capturedAt: Date.now()
        }),
        [activeProject, projectAssets]
    );

    return {
        activeProject,
        projects: state.projects,
        projectAssets,
        characterVersions,
        addProject,
        setActiveProjectId,
        deleteProject,
        updateActiveProject,
        registerProjectAsset,
        attachUserAsset,
        updateProjectAssetKind,
        archiveProjectAsset,
        createCharacterReferencePack,
        buildProductionSnapshot
    };
}
