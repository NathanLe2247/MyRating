import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CommunityView } from '@/components/community/community-view';
import { DiscoverView } from '@/components/community/discover-view';
import type { CommunitySection } from '@/constants/community';
import { Brand } from '@/constants/theme';
import { useCommunityGroups, useDiscoverGroups, useGroupChat } from '@/hooks/use-community';

export default function CommunityScreen() {
  const groups = useCommunityGroups();
  const [section, setSection] = useState<CommunitySection>('mine');
  const [selectedId, setSelectedId] = useState<string>();
  const activeGroupId = selectedId ?? groups[0]?.id;
  const messages = useGroupChat(activeGroupId);
  const [query, setQuery] = useState('');
  const discover = useDiscoverGroups(query);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar style="light" />
      {section === 'discover' ? (
        <DiscoverView
          groupCount={groups.length}
          onMinePress={() => setSection('mine')}
          query={query}
          onChangeQuery={setQuery}
          results={discover}
        />
      ) : (
        <CommunityView
          groups={groups}
          activeGroupId={activeGroupId}
          onSelectGroup={setSelectedId}
          messages={messages}
          onDiscoverPress={() => setSection('discover')}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Brand.background,
  },
});
