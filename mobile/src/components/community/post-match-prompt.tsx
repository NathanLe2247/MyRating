import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { communityStyles, communityText } from '@/components/community/styles';
import { Brand, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type PostMatchPromptProps = {
  onPress?: () => void;
};

// Nudge above the chat input to post a group-wide challenge.
export function PostMatchPrompt({ onPress }: PostMatchPromptProps) {
  const t = en.community.prompt;
  return (
    <View style={styles.strip}>
      <View style={[communityStyles.row, styles.text]}>
        <BrandIcon name="bolt" color={Brand.lime} size={15} />
        <Text style={[communityText.meta, styles.body]} numberOfLines={1}>
          {t.body}
        </Text>
      </View>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        style={[styles.button, !onPress && communityStyles.disabled]}>
        <Text style={[communityText.label, communityText.onLime]}>{t.cta}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    padding: Spacing.two,
    backgroundColor: Brand.chip,
  },
  text: {
    flexShrink: 1,
  },
  body: {
    color: Brand.text,
    flexShrink: 1,
  },
  button: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.lime,
  },
});
