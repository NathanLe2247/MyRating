import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { BrandIcon } from '@/components/brand-icon';
import { communityStyles } from '@/components/community/styles';
import { Brand, BrandFonts, BrandSizes, Spacing } from '@/constants/theme';
import { en } from '@/i18n/en';

type ChatInputBarProps = {
  /** Sends a message. Without it (no chat backend yet) the bar is read-only. */
  onSend?: (text: string) => void;
  onDropChallenge?: () => void;
  onAttachPhoto?: () => void;
};

export function ChatInputBar({ onSend, onDropChallenge, onAttachPhoto }: ChatInputBarProps) {
  const t = en.community.input;
  const [text, setText] = useState('');
  const canSend = !!onSend && text.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <View style={styles.bar}>
      <ActionButton icon="plusCircle" label={t.dropChallenge} onPress={onDropChallenge} />
      <ActionButton icon="camera" label={t.attachPhoto} onPress={onAttachPhoto} />
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={send}
        editable={!!onSend}
        placeholder={t.placeholder}
        placeholderTextColor={Brand.textMuted}
        accessibilityLabel={t.placeholder}
        returnKeyType="send"
        style={styles.input}
      />
      <Pressable
        onPress={send}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel={t.send}
        accessibilityState={{ disabled: !canSend }}
        style={[styles.action, styles.send, !canSend && communityStyles.disabled]}>
        <BrandIcon name="send" color={Brand.onLime} size={16} />
      </Pressable>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: 'plusCircle' | 'camera';
  label: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.action}>
      <BrandIcon name={icon} color={Brand.lime} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    padding: Spacing.one,
    backgroundColor: Brand.input,
  },
  action: {
    width: BrandSizes.chatAction,
    height: BrandSizes.chatAction,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    backgroundColor: Brand.lime,
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: BrandSizes.chatAction,
    paddingHorizontal: Spacing.three,
    borderRadius: BrandSizes.pillRadius,
    backgroundColor: Brand.card,
    fontFamily: BrandFonts.body,
    fontSize: 14,
    color: Brand.text,
  },
});
