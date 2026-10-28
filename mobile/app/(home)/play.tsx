import { ComingSoonScreen } from '@/components/coming-soon-screen';
import { en } from '@/i18n/en';

export default function PlayScreen() {
  return <ComingSoonScreen icon="paddle" title={en.comingSoon.play.title} body={en.comingSoon.play.body} />;
}
