// View-model shapes for the Community tab. These are screen-local and
// display-ready (counts and times already formatted where needed). Once
// groups and chat have cross-app shapes in `shared/` and tables in the
// backend, build these from those instead of extending them here.

export type CommunityGroup = {
  id: string;
  name: string;
  memberCount: number;
  onlineCount: number;
  /** Area the group plays in, e.g. "Austin TX". */
  area?: string;
  photoUrl?: string;
  verified?: boolean;
};

export type ChatPlayer = {
  name: string;
  /** Player rating; null while they're still calibrating. */
  rating: number | null;
  avatarUrl?: string;
  online?: boolean;
};

export type ChatReaction = {
  emoji: string;
  count: number;
};

export type ChatTextMessage = {
  kind: 'text';
  id: string;
  author: ChatPlayer;
  /** Display time, e.g. "5:12 PM". */
  sentAt: string;
  body: string;
  reactions?: ChatReaction[];
};

/** An open challenge posted into the chat: one seat taken, one open. */
export type ChatChallenge = {
  kind: 'challenge';
  id: string;
  challenger: ChatPlayer;
  court: string;
  /** Display time, e.g. "Today 5:30 PM". */
  startsAt: string;
  rated: boolean;
};

/** A day/context divider, e.g. "Today · Zilker Courts active". */
export type ChatDivider = {
  kind: 'divider';
  id: string;
  label: string;
};

export type ChatItem = ChatTextMessage | ChatChallenge | ChatDivider;
