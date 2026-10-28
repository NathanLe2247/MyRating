import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { AppTabIcons, AppTabNames } from '@/constants/tabs';
import { Brand, BrandFonts } from '@/constants/theme';
import { en } from '@/i18n/en';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={Brand.background}
      indicatorColor={Brand.limeSurface}
      labelVisibilityMode="labeled"
      iconColor={{ default: Brand.textFaint, selected: Brand.lime }}
      labelStyle={{
        default: { color: Brand.textFaint, fontFamily: BrandFonts.displaySemiBold },
        selected: { color: Brand.lime, fontFamily: BrandFonts.displaySemiBold },
      }}>
      {AppTabNames.map((name) => (
        <NativeTabs.Trigger key={name} name={name}>
          <NativeTabs.Trigger.Label>{en.tabs[name]}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={AppTabIcons[name].sf} md={AppTabIcons[name].md} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
