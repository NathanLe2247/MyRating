import { ComingSoonScreen } from '@/components/coming-soon-screen';
import { en } from '@/i18n/en';

export default function HealthScreen() {
  return <ComingSoonScreen icon="health" title={en.comingSoon.health.title} body={en.comingSoon.health.body} />;
}
