import { StyleSheet, Text, View } from 'react-native';

import { Brand, BrandFonts, Spacing } from '@/constants/theme';

export function AuthDivider({ label }: { label: string }) {
  return (
    <View style={styles.row}>
      <View style={styles.line} />
      <Text style={styles.label}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  line: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: Brand.border,
  },
  label: {
    fontFamily: BrandFonts.display,
    fontSize: 12,
    letterSpacing: 1.5,
    color: Brand.textMuted,
  },
});
