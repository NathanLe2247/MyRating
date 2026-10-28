import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityView } from '@/components/community/community-view';
import { Brand } from '@/constants/theme';
import { useCommunityGroups, useGroupChat } from '@/hooks/use-community';

export default function CommunityScreen() {
  const groups = useCommunityGroups();
  const [selectedId, setSelectedId] = useState<string>();
  const activeGroupId = selectedId ?? groups[0]?.id;
  const messages = useGroupChat(activeGroupId);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      {/* TODO(#46): pass onDiscoverPress once the discover & search screen exists. */}
      <CommunityView
        groups={groups}
        activeGroupId={activeGroupId}
        onSelectGroup={setSelectedId}
        messages={messages}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Brand.background,
  },
});
