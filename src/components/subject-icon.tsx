import {
  IconCrane,
  IconScale,
  IconSunWind,
  IconVectorTriangle,
  type IconProps,
  type TablerIcon,
} from '@tabler/icons-react';
import type { SubjectId } from '@/lib/types';
import styles from './subject-icon.module.css';

const subjectIcons: Record<SubjectId, TablerIcon> = {
  law: IconScale,
  env: IconSunWind,
  construction: IconCrane,
  structure: IconVectorTriangle,
};

export function SubjectIcon({ subject, ...props }: { subject: SubjectId } & IconProps) {
  const Icon = subjectIcons[subject];
  return <Icon {...props} />;
}

export function SubjectIconBadge({
  subject,
  size = 'compact',
  className,
}: {
  subject: SubjectId;
  size?: 'compact' | 'large';
  className?: string;
}) {
  return (
    <span
      className={[styles.badge, className].filter(Boolean).join(' ')}
      data-subject={subject}
      data-size={size}
      aria-hidden="true"
    >
      <SubjectIcon
        subject={subject}
        size={size === 'large' ? 38 : 18}
        stroke={size === 'large' ? 1.7 : 2}
      />
    </span>
  );
}
