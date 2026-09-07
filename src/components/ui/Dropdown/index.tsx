'use client';

import styles from './index.module.scss';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ReactNode } from 'react';

const EMPTY_VALUE = '__xct_dropdown_empty__';

export type DropdownOption = {
    value: string;
    label: ReactNode;
    selectedLabel?: ReactNode;
    textValue?: string;
    disabled?: boolean;
};

export type DropdownProps = {
    id?: string;
    value: string;
    options: DropdownOption[];
    onValueChange: (value: string) => void;
    placeholder?: ReactNode;
    disabled?: boolean;
    ariaLabel?: string;
    triggerClassName?: string;
    contentClassName?: string;
    size?: 'default' | 'sm';
};

function optionValue(value: string) {
    return value === '' ? EMPTY_VALUE : value;
}

function DropdownItem({ option }: { option: DropdownOption }) {
    return (
        <SelectPrimitive.Item
            value={optionValue(option.value)}
            textValue={option.textValue}
            disabled={option.disabled}
            className={styles.item}>
            <SelectPrimitive.ItemText className={styles.itemText}>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className={styles.indicator}>
                <Check size={15} aria-hidden='true' />
            </SelectPrimitive.ItemIndicator>
        </SelectPrimitive.Item>
    );
}

function ScrollButton({ direction }: { direction: 'up' | 'down' }) {
    const Component = direction === 'up' ? SelectPrimitive.ScrollUpButton : SelectPrimitive.ScrollDownButton;
    const Icon = direction === 'up' ? ChevronUp : ChevronDown;
    return (
        <Component className={styles.scrollButton}>
            <Icon size={15} aria-hidden='true' />
        </Component>
    );
}

export function Dropdown({
    id,
    value,
    options,
    onValueChange,
    placeholder,
    disabled,
    ariaLabel,
    triggerClassName,
    contentClassName,
    size = 'default'
}: DropdownProps) {
    const selectedOption = options.find((option) => option.value === value);

    return (
        <SelectPrimitive.Root
            value={optionValue(value)}
            onValueChange={(nextValue) => onValueChange(nextValue === EMPTY_VALUE ? '' : nextValue)}
            disabled={disabled}>
            <SelectPrimitive.Trigger
                id={id}
                aria-label={ariaLabel}
                data-size={size}
                className={`${styles.trigger}${triggerClassName ? ` ${triggerClassName}` : ''}`}>
                <SelectPrimitive.Value placeholder={placeholder}>
                    {selectedOption?.selectedLabel ?? selectedOption?.label}
                </SelectPrimitive.Value>
                <SelectPrimitive.Icon className={styles.triggerIcon}>
                    <ChevronDown size={16} aria-hidden='true' />
                </SelectPrimitive.Icon>
            </SelectPrimitive.Trigger>
            <SelectPrimitive.Portal>
                <SelectPrimitive.Content
                    position='popper'
                    sideOffset={6}
                    collisionPadding={8}
                    className={`${styles.content}${contentClassName ? ` ${contentClassName}` : ''}`}>
                    <ScrollButton direction='up' />
                    <SelectPrimitive.Viewport className={styles.viewport}>
                        {options.map((option) => (
                            <DropdownItem key={option.value || EMPTY_VALUE} option={option} />
                        ))}
                    </SelectPrimitive.Viewport>
                    <ScrollButton direction='down' />
                </SelectPrimitive.Content>
            </SelectPrimitive.Portal>
        </SelectPrimitive.Root>
    );
}
