import { type ComponentProps, type ReactNode, createContext, useContext, useId, useRef } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Button as BaseButton } from '@base-ui/react/button';
import { Drawer } from '@base-ui/react/drawer';
import { Field } from '@base-ui/react/field';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Select } from '@base-ui/react/select';
import { Toast } from '@base-ui/react/toast';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconEye,
  IconEyeOff,
  IconInfoCircle,
  IconMenu2,
  IconX,
} from '@tabler/icons-react';
import { OriginalOptionLabel } from '@/components/original-option-label';
import styles from './ui.module.css';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export interface ButtonProps extends Omit<
  ComponentProps<typeof BaseButton>,
  'className'
> {
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
  fullWidth?: boolean;
}

export function Button({
  className,
  variant = 'secondary',
  fullWidth,
  ...props
}: ButtonProps) {
  const nativeButton = props.nativeButton ?? !props.render;
  return (
    <BaseButton
      className={cx(
        styles.button,
        styles[variant],
        fullWidth && styles.fullWidth,
        className,
      )}
      nativeButton={nativeButton}
      {...props}
    />
  );
}

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

export function SimpleSelect<T extends string>({
  label,
  value,
  options,
  onValueChange,
  name,
}: {
  label: string;
  value: T;
  options: readonly SelectOption<T>[];
  onValueChange: (value: T) => void;
  name?: string;
}) {
  const items = options.map((option) => ({ label: option.label, value: option.value }));
  return (
    <Select.Root
      items={items}
      name={name}
      value={value}
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
    >
      <div className={styles.fieldStack}>
        <Select.Label className={styles.label}>{label}</Select.Label>
        <Select.Trigger className={styles.selectTrigger} aria-label={label}>
          <Select.Value />
          <Select.Icon className={styles.selectIcon}>
            <IconChevronDown size={17} stroke={2} aria-hidden="true" />
          </Select.Icon>
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner className={styles.selectPositioner} sideOffset={6}>
          <Select.Popup className={styles.selectPopup}>
            <Select.List className={styles.selectList}>
              {options.map((option) => (
                <Select.Item
                  key={option.value}
                  value={option.value}
                  className={styles.selectItem}
                >
                  <Select.ItemIndicator className={styles.selectIndicator}>
                    <IconCheck size={16} stroke={2.5} aria-hidden="true" />
                  </Select.ItemIndicator>
                  <Select.ItemText>{option.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}

/** Longer than a double-tap, shorter than a change of mind. */
const REPEAT_TAP_MS = 500;

export function OptionGroup({
  label,
  options,
  value,
  disabled,
  originalOptionIndexes,
  eliminatedValues = [],
  onValueChange,
  onToggleEliminated,
}: {
  label: string;
  options: readonly string[];
  value?: number;
  disabled?: boolean;
  /** Optional post-answer references, in the same order as the displayed options. */
  originalOptionIndexes?: readonly number[];
  eliminatedValues?: readonly number[];
  onValueChange: (value: number | undefined) => void;
  onToggleEliminated?: (value: number) => void;
}) {
  const optionId = useId();
  const eliminated = new Set(eliminatedValues);
  // When the current answer was picked: a double-tap must not pick it and clear it again.
  const pickedAt = useRef(0);

  return (
    <Field.Root className={styles.optionField}>
      <Field.Label className={styles.visuallyHidden}>{label}</Field.Label>
      <RadioGroup
        aria-label={label}
        value={value === undefined ? '' : String(value)}
        disabled={disabled}
        onValueChange={(nextValue) => {
          pickedAt.current = Date.now();
          onValueChange(Number(nextValue));
        }}
        className={styles.options}
      >
        {options.map((option, index) => {
          const optionLetter = String.fromCharCode(65 + index);
          const optionEliminated = eliminated.has(index);

          return (
            <div
              className={styles.optionRow}
              data-eliminated={optionEliminated || undefined}
              key={index}
            >
              <label
                className={styles.option}
                data-eliminated={optionEliminated || undefined}
                onClickCapture={(event) => {
                  if (disabled || optionEliminated || value !== index) return;
                  // Cover the whole label, including text and Base UI's hidden input.
                  event.preventDefault();
                  // Keyboard activation reports detail 0 and is always deliberate.
                  if (event.detail > 0 && Date.now() - pickedAt.current < REPEAT_TAP_MS) return;
                  onValueChange(undefined);
                }}
              >
                <Radio.Root
                  value={String(index)}
                  aria-labelledby={`${optionId}-letter-${index} ${optionId}-text-${index}`}
                  className={styles.radio}
                  disabled={optionEliminated}
                >
                  <Radio.Indicator className={styles.radioIndicator} />
                </Radio.Root>
                <span id={`${optionId}-letter-${index}`} className={styles.optionLetter}>{optionLetter}</span>
                <span id={`${optionId}-text-${index}`}>
                  <span className={styles.optionText}>{option}</span>
                  <OriginalOptionLabel index={originalOptionIndexes?.[index]} />
                </span>
              </label>
              {onToggleEliminated ? (
                <button
                  type="button"
                  className={styles.eliminateOption}
                  aria-label={
                    optionEliminated
                      ? `恢復選項 ${optionLetter}`
                      : `刪去選項 ${optionLetter}`
                  }
                  aria-pressed={optionEliminated}
                  disabled={disabled || value === index}
                  onClick={() => onToggleEliminated(index)}
                >
                  {optionEliminated ? (
                    <IconEye size={18} stroke={2} aria-hidden="true" />
                  ) : (
                    <IconEyeOff size={18} stroke={2} aria-hidden="true" />
                  )}
                </button>
              ) : null}
            </div>
          );
        })}
      </RadioGroup>
    </Field.Root>
  );
}

/** success: an action finished; error: it failed; info: nothing was done, and why. */
export type ToastTone = 'success' | 'error' | 'info';

interface ToastContextValue {
  notify: (title: string, description?: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const toastIcons = {
  success: IconCheck,
  error: IconAlertTriangle,
  info: IconInfoCircle,
} satisfies Record<ToastTone, typeof IconCheck>;

function toastTone(type: string | undefined): ToastTone {
  return type === 'error' || type === 'info' ? type : 'success';
}

function ToastBridge({ children }: { children: ReactNode }) {
  const manager = Toast.useToastManager();
  return (
    <ToastContext.Provider
      value={{
        notify: (title, description, tone = 'success') =>
          manager.add({ title, description, type: tone, timeout: 2600 }),
      }}
    >
      {children}
      <Toast.Portal>
        <Toast.Viewport className={styles.toastViewport}>
          {manager.toasts.map((toast) => {
            const tone = toastTone(toast.type);
            const ToneIcon = toastIcons[tone];
            return (
              <Toast.Root key={toast.id} toast={toast} className={styles.toastRoot}>
                <Toast.Content className={styles.toastContent}>
                  <span className={styles.toastMark} data-tone={tone}>
                    <ToneIcon size={18} stroke={2.5} aria-hidden="true" />
                  </span>
                  <div className={styles.toastText}>
                    <Toast.Title className={styles.toastTitle} />
                    <Toast.Description className={styles.toastDescription} />
                  </div>
                  <Toast.Close className={styles.toastClose} aria-label="關閉通知">
                    <IconX size={19} stroke={2} aria-hidden="true" />
                  </Toast.Close>
                </Toast.Content>
              </Toast.Root>
            );
          })}
        </Toast.Viewport>
      </Toast.Portal>
    </ToastContext.Provider>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider limit={3} timeout={2600}>
      <ToastBridge>{children}</ToastBridge>
    </Toast.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within ToastProvider');
  return context;
}

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = 'danger',
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  /** danger: destructive (red icon box, danger confirm); warning: irreversible but not destructive (amber icon box, primary confirm). */
  tone?: 'danger' | 'warning';
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={trigger as React.ReactElement} />
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={styles.backdrop} />
        <AlertDialog.Viewport className={styles.dialogViewport}>
          <AlertDialog.Popup className={styles.dialogPopup}>
            <div className={cx(styles.dialogIcon, tone === 'warning' && styles.dialogIconWarning)}>
              <IconAlertTriangle size={25} stroke={2} aria-hidden="true" />
            </div>
            <AlertDialog.Title className={styles.dialogTitle}>{title}</AlertDialog.Title>
            <AlertDialog.Description className={styles.dialogDescription}>
              {description}
            </AlertDialog.Description>
            <div className={styles.dialogActions}>
              <AlertDialog.Close className={cx(styles.button, styles.secondary)}>
                取消
              </AlertDialog.Close>
              <AlertDialog.Close
                className={cx(styles.button, tone === 'warning' ? styles.primary : styles.danger)}
                onClick={onConfirm}
              >
                {confirmLabel}
              </AlertDialog.Close>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function SideDrawer({
  open,
  onOpenChange,
  triggerLabel,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerLabel: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} swipeDirection="left">
      <Drawer.Trigger className={cx(styles.button, styles.icon, styles.mobileTrigger)}>
        <IconMenu2 size={21} stroke={2} aria-hidden="true" />
        <span className={styles.visuallyHidden}>{triggerLabel}</span>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Backdrop className={styles.backdrop} />
        <Drawer.Viewport className={styles.drawerViewport}>
          <Drawer.Popup className={styles.drawerPopup}>
            <Drawer.Title className={styles.visuallyHidden}>{title}</Drawer.Title>
            <Drawer.Description className={styles.visuallyHidden}>
              網站主要功能導覽
            </Drawer.Description>
            <Drawer.Content className={styles.drawerContent}>{children}</Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
