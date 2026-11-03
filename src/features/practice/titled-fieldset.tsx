import { type ComponentProps, useId } from 'react';
import styles from './practice-page.module.css';

/**
 * Titled by an ordinary first child, not a <legend>: in a grid fieldset WebKit ignores float on a
 * legend, keeps it above the padding and over the border, and does not resize it with the fieldset.
 */
export function TitledFieldset({
  title,
  children,
  ...props
}: ComponentProps<'fieldset'> & { title: string }) {
  const titleId = useId();
  return (
    <fieldset aria-labelledby={titleId} {...props}>
      <div id={titleId} className={styles.fieldsetTitle}>
        {title}
      </div>
      {children}
    </fieldset>
  );
}
