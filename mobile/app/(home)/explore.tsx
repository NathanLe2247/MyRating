import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExternalLink } from '@/components/external-link';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { WebBadge } from '@/components/web-badge';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { en } from '@/i18n/en';

export default function TabTwoScreen() {
  const safeAreaInsets = useSafeAreaInsets();
  const insets = {
    ...safeAreaInsets,
    bottom: safeAreaInsets.bottom + BottomTabInset + Spacing.three,
  };
  const theme = useTheme();

  const contentPlatformStyle = Platform.select({
    android: {
      paddingTop: insets.top,
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingBottom: insets.bottom,
    },
    web: {
      paddingTop: Spacing.six,
      paddingBottom: Spacing.four,
    },
  });

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: theme.background }]}
      contentInset={insets}
      contentContainerStyle={[styles.contentContainer, contentPlatformStyle]}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="subtitle">{en.explore.title}</ThemedText>
          <ThemedText style={styles.centerText} themeColor="textSecondary">
            {en.explore.subtitle}
          </ThemedText>

          <ExternalLink href="https://docs.expo.dev" asChild>
            <Pressable style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.linkButton}>
                <ThemedText type="link">{en.explore.expoDocsLink}</ThemedText>
                <SymbolView
                  tintColor={theme.text}
                  name={{ ios: 'arrow.up.right.square', android: 'link', web: 'link' }}
                  size={12}
                />
              </ThemedView>
            </Pressable>
          </ExternalLink>
        </ThemedView>

        <ThemedView style={styles.sectionsWrapper}>
          <Collapsible title={en.explore.sections.routing.title}>
            <ThemedText type="small">
              {en.explore.sections.routing.body1Before}{' '}
              <ThemedText type="code">{en.explore.sections.routing.body1ScreenOne}</ThemedText>{' '}
              {en.explore.sections.routing.body1And}{' '}
              <ThemedText type="code">{en.explore.sections.routing.body1ScreenTwo}</ThemedText>
            </ThemedText>
            <ThemedText type="small">
              {en.explore.sections.routing.body2Before}{' '}
              <ThemedText type="code">{en.explore.sections.routing.body2Layout}</ThemedText>{' '}
              {en.explore.sections.routing.body2After}
            </ThemedText>
            <ExternalLink href="https://docs.expo.dev/router/introduction">
              <ThemedText type="linkPrimary">{en.explore.learnMore}</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={en.explore.sections.platforms.title}>
            <ThemedView type="backgroundElement" style={styles.collapsibleContent}>
              <ThemedText type="small">
                {en.explore.sections.platforms.bodyBefore}{' '}
                <ThemedText type="smallBold">{en.explore.sections.platforms.webKey}</ThemedText>{' '}
                {en.explore.sections.platforms.bodyAfter}
              </ThemedText>
              <Image
                source={require('@/assets/images/tutorial-web.png')}
                style={styles.imageTutorial}
              />
            </ThemedView>
          </Collapsible>

          <Collapsible title={en.explore.sections.images.title}>
            <ThemedText type="small">
              {en.explore.sections.images.bodyBefore}{' '}
              <ThemedText type="code">{en.explore.sections.images.suffixOne}</ThemedText>{' '}
              {en.explore.sections.images.bodyAnd}{' '}
              <ThemedText type="code">{en.explore.sections.images.suffixTwo}</ThemedText>{' '}
              {en.explore.sections.images.bodyAfter}
            </ThemedText>
            <Image source={require('@/assets/images/react-logo.png')} style={styles.imageReact} />
            <ExternalLink href="https://reactnative.dev/docs/images">
              <ThemedText type="linkPrimary">{en.explore.learnMore}</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={en.explore.sections.colorScheme.title}>
            <ThemedText type="small">
              {en.explore.sections.colorScheme.bodyBefore}{' '}
              <ThemedText type="code">{en.explore.sections.colorScheme.hook}</ThemedText>{' '}
              {en.explore.sections.colorScheme.bodyAfter}
            </ThemedText>
            <ExternalLink href="https://docs.expo.dev/develop/user-interface/color-themes/">
              <ThemedText type="linkPrimary">{en.explore.learnMore}</ThemedText>
            </ExternalLink>
          </Collapsible>

          <Collapsible title={en.explore.sections.animations.title}>
            <ThemedText type="small">
              {en.explore.sections.animations.bodyBefore}{' '}
              <ThemedText type="code">{en.explore.sections.animations.component}</ThemedText>{' '}
              {en.explore.sections.animations.bodyMiddle}{' '}
              <ThemedText type="code">{en.explore.sections.animations.library}</ThemedText>{' '}
              {en.explore.sections.animations.bodyAfter}
            </ThemedText>
          </Collapsible>
        </ThemedView>
        {Platform.OS === 'web' && <WebBadge />}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  container: {
    maxWidth: MaxContentWidth,
    flexGrow: 1,
  },
  titleContainer: {
    gap: Spacing.three,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.six,
  },
  centerText: {
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  linkButton: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    justifyContent: 'center',
    gap: Spacing.one,
    alignItems: 'center',
  },
  sectionsWrapper: {
    gap: Spacing.five,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  collapsibleContent: {
    alignItems: 'center',
  },
  imageTutorial: {
    width: '100%',
    aspectRatio: 296 / 171,
    borderRadius: Spacing.three,
    marginTop: Spacing.two,
  },
  imageReact: {
    width: 100,
    height: 100,
    alignSelf: 'center',
  },
});
