import { StyleSheet, Text } from 'react-native';

import { Brand, BrandFonts } from '@/constants/theme';

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.error} accessibilityRole="alert">
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: BrandFonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: Brand.error,
    textAlign: 'center',
  },
});
