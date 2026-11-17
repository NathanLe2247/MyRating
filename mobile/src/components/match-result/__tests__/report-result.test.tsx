import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { ReportResultCard } from '@/components/home/report-result-card';
import { ReportResult, type ReportResultProps } from '@/components/match-result/report-result';
import { en } from '@/i18n/en';
import { DemoRatingChange } from '@/test-utils/match-results';
import { MatchId } from '@/test-utils/matchmaking';
import type { ReportResultStage, ScoreDraft } from '@/types/match-results';
import { addGame, draftProblem, emptyDraft, removeLastGame, selectGame, stepPoints } from '@/utils/match-result';

const t = en.reportResult;
const Opponent = 'Demo Tester';
const twoGames = [
  { you: 11, opponent: 7 },
  { you: 11, opponent: 9 },
];

const handlers = () => ({
  onStep: jest.fn(),
  onSelectGame: jest.fn(),
  onAddGame: jest.fn(),
  onRemoveGame: jest.fn(),
  onSubmit: jest.fn(),
  onConfirm: jest.fn(),
  onDispute: jest.fn(),
  onDone: jest.fn(),
});

function props(stage: ReportResultStage, extra: Partial<ReportResultProps> = {}): ReportResultProps {
  return {
    view: { matchId: MatchId, opponent: Opponent, court: 'Anchor Park Courts', stage },
    draft: emptyDraft(),
    ...handlers(),
    ...extra,
  };
}

/** The score form with its draft kept the way `useMatchResult` keeps it. */
function ScoreForm({ onSubmit }: { onSubmit: (draft: ScoreDraft) => void }) {
  const [draft, setDraft] = useState(emptyDraft());
  return (
    <ReportResult
      {...props({ kind: 'enter' })}
      draft={draft}
      problem={draftProblem(MatchId, draft.games)}
      onStep={(side, delta) => setDraft((d) => stepPoints(d, side, delta))}
      onSelectGame={(i) => setDraft((d) => selectGame(d, i))}
      onAddGame={() => setDraft(addGame)}
      onRemoveGame={() => setDraft(removeLastGame)}
      onSubmit={() => onSubmit(draft)}
    />
  );
}

const press = (name: string | RegExp, times = 1) => {
  for (let i = 0; i < times; i++) fireEvent.press(screen.getByRole('button', { name }));
};
const submitButton = () => screen.getByRole('button', { name: t.submit });

describe('ReportResult score form', () => {
  it('keeps Submit disabled with a one-line reason until the score is valid', () => {
    const onSubmit = jest.fn();
    render(<ScoreForm onSubmit={onSubmit} />);

    expect(screen.getByText(t.problems.blank)).toBeTruthy();
    expect(submitButton()).toBeDisabled();

    press(t.pointUp(t.youLabel), 9);
    press(t.pointUp(Opponent), 7);
    expect(screen.getByText(/9–7 isn.t finished/)).toBeTruthy();
    expect(submitButton()).toBeDisabled();

    press(t.pointUp(t.youLabel), 2);
    expect(screen.getByLabelText(t.points(t.you, 11))).toBeTruthy();
    expect(screen.queryByText(/isn.t finished/)).toBeNull();
    expect(submitButton()).toBeEnabled();

    fireEvent.press(submitButton());
    expect(onSubmit).toHaveBeenCalledWith({ games: [{ you: 11, opponent: 7 }], active: 0 });
  });

  it('enters games on their own tabs, up to three', () => {
    const onSubmit = jest.fn();
    render(<ScoreForm onSubmit={onSubmit} />);
    press(t.pointUp(t.youLabel), 11);
    press(t.pointUp(Opponent), 7);

    press(t.addGameLabel);
    expect(screen.getByRole('tab', { name: t.game(2), selected: true })).toBeTruthy();
    press(t.pointUp(t.youLabel), 11);
    press(t.pointUp(Opponent), 9);
    fireEvent.press(submitButton());
    expect(onSubmit).toHaveBeenLastCalledWith({ games: twoGames, active: 1 });

    // A third game after 2–0 is refused; it can be removed again.
    press(t.addGameLabel);
    expect(screen.queryByRole('button', { name: t.addGameLabel })).toBeNull();
    press(t.pointUp(t.youLabel), 11);
    expect(screen.getByText(/^Game 3: .*already won 2–0/)).toBeTruthy();
    expect(submitButton()).toBeDisabled();
    press(t.removeGame);
    expect(submitButton()).toBeEnabled();

    fireEvent.press(screen.getByRole('tab', { name: t.game(1) }));
    expect(screen.getByLabelText(t.points(Opponent, 7))).toBeTruthy();
  });

  it("can't go below zero", () => {
    render(<ScoreForm onSubmit={jest.fn()} />);
    expect(screen.getByRole('button', { name: t.pointDown(t.youLabel) })).toBeDisabled();
  });

  it('disables the form while submitting and shows a failed call', () => {
    render(<ReportResult {...props({ kind: 'enter' }, { busy: true, error: t.errors.network })} />);
    expect(screen.getByRole('button', { name: t.pointUp(t.youLabel) })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent(t.errors.network);
  });
});

describe('ReportResult stages', () => {
  it('waits on the opponent after the player reports', () => {
    render(<ReportResult {...props({ kind: 'waiting', games: twoGames })} />);
    expect(screen.getByText(t.yourScore('11–7, 11–9'))).toBeTruthy();
    expect(screen.getByText(t.waiting(Opponent))).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it("lets the opponent's report be confirmed or disputed", () => {
    const p = props({ kind: 'answer', games: [{ you: 7, opponent: 11 }] });
    render(<ReportResult {...p} />);
    expect(screen.getByText(t.reported(Opponent, '7–11'))).toBeTruthy();

    press(t.confirm);
    expect(p.onConfirm).toHaveBeenCalled();
    press(t.dispute);
    expect(p.onDispute).toHaveBeenCalled();
  });

  it('shows the final score and the rating change from the backend', () => {
    const p = props({ kind: 'confirmed', games: twoGames, won: true, ratingChange: DemoRatingChange });
    render(<ReportResult {...p} />);
    expect(screen.getByRole('header', { name: t.confirmed })).toBeTruthy();
    expect(screen.getByText(t.won('11–7, 11–9'))).toBeTruthy();
    expect(screen.getByText('1500.00 → 1523.45 (+23.45)')).toBeTruthy();

    press(t.done);
    expect(p.onDone).toHaveBeenCalled();
  });

  it('shows a loss without a rating line when the backend has none', () => {
    render(<ReportResult {...props({ kind: 'confirmed', games: [{ you: 7, opponent: 11 }], won: false, ratingChange: null })} />);
    expect(screen.getByText(t.lost('7–11'))).toBeTruthy();
    expect(screen.queryByText(t.ratingLabel)).toBeNull();
  });

  it('shows a disputed result', () => {
    render(<ReportResult {...props({ kind: 'disputed', games: twoGames })} />);
    expect(screen.getByRole('header', { name: t.disputed })).toBeTruthy();
    expect(screen.getByText(t.disputedBody('11–7, 11–9'))).toBeTruthy();
  });
});

describe('ReportResultCard', () => {
  it('names the opponent and court and opens the match', () => {
    const onOpenMatch = jest.fn();
    render(<ReportResultCard {...props({ kind: 'enter' })} onOpenMatch={onOpenMatch} />);
    expect(screen.getByRole('header', { name: t.title })).toBeTruthy();
    expect(screen.getByText(`vs. ${Opponent} · at Anchor Park Courts`)).toBeTruthy();

    fireEvent.press(screen.getByRole('link', { name: t.openMatch }));
    expect(onOpenMatch).toHaveBeenCalled();
  });

  it('drops the link once the result is settled', () => {
    render(<ReportResultCard {...props({ kind: 'disputed', games: twoGames })} onOpenMatch={jest.fn()} />);
    expect(screen.queryByRole('link', { name: t.openMatch })).toBeNull();
  });
});
