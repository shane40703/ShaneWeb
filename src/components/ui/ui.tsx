import {
  type ComponentProps,
  type ReactNode,
  createContext,
  useContext,
  useId,
} from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Button as BaseButton } from '@base-ui/react/button';
import { Drawer } from '@base-ui/react/drawer';
import { Field } from '@base-ui/react/field';
import { NumberField } from '@base-ui/react/number-field';
import { Progress } from '@base-ui/react/progress';
import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Select } from '@base-ui/react/select';
import { Switch } from '@base-ui/react/switch';
import { Toast } from '@base-ui/react/toast';
import styles from './ui.module.css';

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export interface ButtonProps extends Omit<ComponentProps<typeof BaseButton>, 'className'> {
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
      className={cx(styles.button, styles[variant], fullWidth && styles.fullWidth, className)}
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
          <Select.Icon className={styles.selectIcon}>⌄</Select.Icon>
        </Select.Trigger>
      </div>
      <Select.Portal>
        <Select.Positioner className={styles.selectPositioner} sideOffset={6}>
          <Select.Popup className={styles.selectPopup}>
            <Select.List className={styles.selectList}>
              {options.map((option) => (
                <Select.Item key={option.value} value={option.value} className={styles.selectItem}>
                  <Select.ItemIndicator className={styles.selectIndicator}>✓</Select.ItemIndicator>
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

export function ToggleSwitch({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const id = useId();
  return (
    <div className={styles.switchRow}>
      <label htmlFor={id} className={styles.switchCopy}>
        <strong>{label}</strong>
        {description ? <span>{description}</span> : null}
      </label>
      <Switch.Root
        id={id}
        aria-label={label}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={styles.switch}
      >
        <Switch.Thumb className={styles.switchThumb} />
      </Switch.Root>
    </div>
  );
}

export function QuantityField({
  label,
  value,
  min,
  max,
  onValueChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onValueChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <NumberField.Root
      id={id}
      value={value}
      min={min}
      max={max}
      onValueChange={(nextValue) => nextValue !== null && onValueChange(nextValue)}
      className={styles.fieldStack}
    >
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <NumberField.Group className={styles.numberGroup}>
        <NumberField.Decrement aria-label="減少" className={styles.numberButton}>
          −
        </NumberField.Decrement>
        <NumberField.Input className={styles.numberInput} />
        <NumberField.Increment aria-label="增加" className={styles.numberButton}>
          ＋
        </NumberField.Increment>
      </NumberField.Group>
    </NumberField.Root>
  );
}

export function OptionGroup({
  label,
  options,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  options: readonly string[];
  value?: number;
  disabled?: boolean;
  onValueChange: (value: number) => void;
}) {
  return (
    <Field.Root className={styles.optionField}>
      <Field.Label className={styles.visuallyHidden}>{label}</Field.Label>
      <RadioGroup
        aria-label={label}
        value={value === undefined ? '' : String(value)}
        disabled={disabled}
        onValueChange={(nextValue) => onValueChange(Number(nextValue))}
        className={styles.options}
      >
        {options.map((option, index) => (
          <label className={styles.option} key={option}>
            <Radio.Root value={String(index)} className={styles.radio}>
              <Radio.Indicator className={styles.radioIndicator} />
            </Radio.Root>
            <span className={styles.optionLetter}>{String.fromCharCode(65 + index)}</span>
            <span>{option}</span>
          </label>
        ))}
      </RadioGroup>
    </Field.Root>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  return (
    <Progress.Root className={styles.progressRoot} value={value} aria-label={label}>
      <Progress.Track className={styles.progressTrack}>
        <Progress.Indicator className={styles.progressIndicator} />
      </Progress.Track>
    </Progress.Root>
  );
}

interface ToastContextValue {
  notify: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastBridge({ children }: { children: ReactNode }) {
  const manager = Toast.useToastManager();
  return (
    <ToastContext.Provider
      value={{
        notify: (title, description) => manager.add({ title, description, timeout: 2600 }),
      }}
    >
      {children}
      <Toast.Portal>
        <Toast.Viewport className={styles.toastViewport}>
          {manager.toasts.map((toast) => (
            <Toast.Root key={toast.id} toast={toast} className={styles.toastRoot}>
              <Toast.Content className={styles.toastContent}>
                <span className={styles.toastMark}>✓</span>
                <div className={styles.toastText}>
                  <Toast.Title className={styles.toastTitle} />
                  <Toast.Description className={styles.toastDescription} />
                </div>
                <Toast.Close className={styles.toastClose} aria-label="關閉通知">
                  ×
                </Toast.Close>
              </Toast.Content>
            </Toast.Root>
          ))}
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
}: {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger render={trigger as React.ReactElement} />
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={styles.backdrop} />
        <AlertDialog.Viewport className={styles.dialogViewport}>
          <AlertDialog.Popup className={styles.dialogPopup}>
            <div className={styles.dialogIcon}>!</div>
            <AlertDialog.Title className={styles.dialogTitle}>{title}</AlertDialog.Title>
            <AlertDialog.Description className={styles.dialogDescription}>
              {description}
            </AlertDialog.Description>
            <div className={styles.dialogActions}>
              <AlertDialog.Close className={cx(styles.button, styles.secondary)}>
                取消
              </AlertDialog.Close>
              <AlertDialog.Close
                className={cx(styles.button, styles.danger)}
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
        <span aria-hidden="true">☰</span>
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
