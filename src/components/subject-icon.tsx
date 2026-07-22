import {
  IconCrane,
  IconScale,
  IconSunWind,
  IconVectorTriangle,
  type IconProps,
  type TablerIcon,
} from '@tabler/icons-react';
import type { SubjectId } from '@/lib/types';

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
