import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChatInputBar } from '@/components/community/chat-input-bar';
import { CommunityView } from '@/components/community/community-view';
import { en } from '@/i18n/en';
import type { ChatItem, CommunityGroup } from '@/types/community';

const copy = en.community;

// Test fixtures only; the app never shows placeholder groups or messages.
const groups: CommunityGroup[] = [
  { id: 'g1', name: 'Test Squad', memberCount: 24, onlineCount: 3, area: 'Testville', verified: true },
  { id: 'g2', name: 'Other Squad', memberCount: 9, onlineCount: 0 },
];

const messages: ChatItem[] = [
  { kind: 'divider', id: 'd1', label: 'Today' },
  {
    kind: 'text',
    id: 'm1',
    author: { name: 'Pat Q.', rating: 4.2, online: true },
    sentAt: '5:12 PM',
    body: 'Anyone up for a game?',
    reactions: [{ emoji: '⚡', count: 4 }],
  },
  {
    kind: 'text',
    id: 'm2',
    author: { name: 'New Player', rating: null },
    sentAt: '5:13 PM',
    body: 'Count me in',
  },
  {
    kind: 'challenge',
    id: 'c1',
    challenger: { name: 'Pat Q.', rating: 4.2 },
    court: 'Test Park #1',
    startsAt: 'Today 5:30 PM',
    rated: true,
  },
];

const noop = () => {};

describe('CommunityView', () => {
  describe('empty state', () => {
    it('shows the empty state and no room or chat when the player has no groups', () => {
      render(<CommunityView groups={[]} activeGroupId={undefined} onSelectGroup={noop} messages={[]} />);

      expect(screen.getByText(copy.empty.title)).toBeOnTheScreen();
      expect(screen.getByText(copy.empty.body)).toBeOnTheScreen();
      expect(screen.getByRole('tab', { name: new RegExp(copy.sections.mine) })).toBeOnTheScreen();
      expect(screen.queryByText(copy.joined)).toBeNull();
      expect(screen.queryByLabelText(copy.input.send)).toBeNull();
    });

    it('leaves discover disabled until there is a discover screen', () => {
      render(<CommunityView groups={[]} activeGroupId={undefined} onSelectGroup={noop} messages={[]} />);

      expect(screen.getByRole('button', { name: new RegExp(copy.empty.cta) })).toBeDisabled();
      expect(screen.getByRole('tab', { name: new RegExp(copy.sections.discover) })).toBeDisabled();
    });

    it('opens discover from the empty state and the switcher when wired', () => {
      const onDiscoverPress = jest.fn();
      render(
        <CommunityView
          groups={[]}
          activeGroupId={undefined}
          onSelectGroup={noop}
          messages={[]}
          onDiscoverPress={onDiscoverPress}
        />,
      );

      fireEvent.press(screen.getByRole('button', { name: new RegExp(copy.empty.cta) }));
      fireEvent.press(screen.getByRole('tab', { name: new RegExp(copy.sections.discover) }));
      expect(onDiscoverPress).toHaveBeenCalledTimes(2);
    });
  });

  describe('loaded state', () => {
    it('shows the active group room with its counts', () => {
      render(<CommunityView groups={groups} activeGroupId="g1" onSelectGroup={noop} messages={messages} />);

      expect(screen.queryByText(copy.empty.title)).toBeNull();
      expect(screen.getByRole('header', { name: 'Test Squad' })).toBeOnTheScreen();
      expect(screen.getByText(copy.members(24))).toBeOnTheScreen();
      expect(screen.getByText(copy.online(3))).toBeOnTheScreen();
      expect(screen.getByText('Testville')).toBeOnTheScreen();
      expect(screen.getByLabelText(copy.a11y.verified)).toBeOnTheScreen();
      expect(screen.getByRole('tab', { name: copy.a11y.memberCount('Test Squad', 24) })).toBeSelected();
    });

    it('falls back to the first group when none is selected', () => {
      render(<CommunityView groups={groups} activeGroupId={undefined} onSelectGroup={noop} messages={[]} />);

      expect(screen.getByRole('header', { name: 'Test Squad' })).toBeOnTheScreen();
    });

    it('switches rooms when another group chip is tapped', () => {
      const onSelectGroup = jest.fn();
      render(<CommunityView groups={groups} activeGroupId="g1" onSelectGroup={onSelectGroup} messages={[]} />);

      fireEvent.press(screen.getByRole('tab', { name: copy.a11y.memberCount('Other Squad', 9) }));
      expect(onSelectGroup).toHaveBeenCalledWith('g2');
    });

    it('renders chat messages, ratings, reactions, and dividers', () => {
      render(<CommunityView groups={groups} activeGroupId="g1" onSelectGroup={noop} messages={messages} />);

      expect(screen.getByText('Today')).toBeOnTheScreen();
      expect(screen.getByText('Anyone up for a game?')).toBeOnTheScreen();
      expect(screen.getByText(copy.chat.rating('4.20'))).toBeOnTheScreen();
      expect(screen.getByText(copy.chat.unrated)).toBeOnTheScreen();
      expect(screen.getByText(copy.chat.reaction('⚡', 4))).toBeOnTheScreen();
    });

    it('renders an open challenge with its details', () => {
      render(<CommunityView groups={groups} activeGroupId="g1" onSelectGroup={noop} messages={messages} />);

      expect(screen.getByText(copy.challenge.live)).toBeOnTheScreen();
      expect(screen.getByText(copy.challenge.rated)).toBeOnTheScreen();
      expect(screen.getByText(copy.challenge.rating('4.20'))).toBeOnTheScreen();
      expect(screen.getByText(copy.challenge.openSeat)).toBeOnTheScreen();
      expect(screen.getByText('Test Park #1')).toBeOnTheScreen();
      expect(screen.getByText('Today 5:30 PM')).toBeOnTheScreen();
      // No challenge backend yet, so the actions can't be taken.
      expect(screen.getByRole('button', { name: new RegExp(copy.challenge.accept) })).toBeDisabled();
    });

    it('says so when the room has no messages yet', () => {
      render(<CommunityView groups={groups} activeGroupId="g1" onSelectGroup={noop} messages={[]} />);

      expect(screen.getByText(copy.chat.empty)).toBeOnTheScreen();
    });
  });
});

describe('ChatInputBar', () => {
  it('is read-only without a send handler', () => {
    render(<ChatInputBar />);

    expect(screen.getByLabelText(copy.input.placeholder)).not.toBeEnabled();
    expect(screen.getByRole('button', { name: copy.input.send })).toBeDisabled();
  });

  it('sends the trimmed message and clears the field', () => {
    const onSend = jest.fn();
    render(<ChatInputBar onSend={onSend} />);

    const send = screen.getByRole('button', { name: copy.input.send });
    expect(send).toBeDisabled();

    fireEvent.changeText(screen.getByLabelText(copy.input.placeholder), '  see you at 5  ');
    fireEvent.press(send);

    expect(onSend).toHaveBeenCalledWith('see you at 5');
    expect(screen.getByLabelText(copy.input.placeholder)).toHaveDisplayValue('');
  });
});
