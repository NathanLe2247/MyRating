import type { ReportResultProps } from '@/components/match-result/report-result';
import { useMatchResult } from '@/hooks/use-match-result';
import { addGame, removeLastGame, selectGame, stepPoints } from '@/utils/match-result';

/**
 * Props for `ReportResult` from the shared match result, or null when
 * there's no match to report. Home's card and Match Found both use it, so
 * they show (and edit) the same score.
 */
export function useReportResult(): ReportResultProps | null {
  const { view, draft, problem, busy, error, editDraft, submit, confirm, dispute, dismiss } = useMatchResult();
  if (!view) return null;
  return {
    view,
    draft,
    problem,
    busy,
    error,
    onStep: (side, delta) => editDraft((d) => stepPoints(d, side, delta)),
    onSelectGame: (index) => editDraft((d) => selectGame(d, index)),
    onAddGame: () => editDraft(addGame),
    onRemoveGame: () => editDraft(removeLastGame),
    onSubmit: () => void submit(),
    onConfirm: () => void confirm(),
    onDispute: () => void dispute(),
    onDone: dismiss,
  };
}
