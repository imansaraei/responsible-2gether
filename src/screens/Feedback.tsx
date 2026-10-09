import { useState, type FormEvent } from 'react';
import { useHousehold } from '../state/HouseholdContext';
import { useWeek } from '../firebase/hooks';
import { addFeedback, deleteFeedback } from '../firebase/repo';
import { feedbackCounts, ratioWarning } from '../domain/scoring';
import { other, type FeedbackKind } from '../domain/types';

export function Feedback() {
  const { code, me, members, currentWeekId } = useHousehold();
  const { feedback } = useWeek(code, currentWeekId);
  const [kind, setKind] = useState<FeedbackKind>('plus');
  const [text, setText] = useState('');
  const partner = members[other(me)].name;
  const given = feedback.filter((f) => f.from === me);
  const { plus, minus } = feedbackCounts(feedback, me);
  const warn = ratioWarning(plus, minus + (kind === 'minus' ? 1 : 0));

  function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    void addFeedback(code, currentWeekId, { from: me, kind, text: text.trim() });
    setText('');
  }

  return (
    <main className="page">
      <h1>Feedback</h1>
      <p className="muted">How helpful has {partner} been around the house?</p>

      <form className="card stack" onSubmit={send}>
        <div className="kind-toggle" role="radiogroup" aria-label="Kind of feedback">
          <button type="button" role="radio" aria-checked={kind === 'plus'} className={kind === 'plus' ? 'on plus' : ''} onClick={() => setKind('plus')}>＋ Appreciated</button>
          <button type="button" role="radio" aria-checked={kind === 'minus'} className={kind === 'minus' ? 'on minus' : ''} onClick={() => setKind('minus')}>－ Needs work</button>
        </div>
        <label>Note
          <textarea value={text} maxLength={280} onChange={(e) => setText(e.target.value)}
            placeholder={kind === 'plus' ? 'Thanks for folding the laundry!' : 'Plate left on the sofa after dinner'} />
        </label>
        {kind === 'minus' && <p className="muted small">This lowers {partner}’s helpfulness by 10% and becomes a task on their to-do list.</p>}
        <button className="btn primary" disabled={!text.trim()}>Send</button>
      </form>

      {warn && (
        <div className="warning" role="alert">
          <strong>Lots of negative feedback this week.</strong> You’ve given {plus} positive and {minus} negative so far.
          Too much negative feedback is usually just destructive. Consider redefining tasks, talking it through, or simply giving more positive feedback — aim for at least two positives per negative.
        </div>
      )}

      <h2>You gave this week <span className="muted small">＋{plus} · －{minus}</span></h2>
      {given.length === 0 ? <p className="muted">Nothing yet.</p> : (
        <ul className="cards">
          {given.map((f) => (
            <li key={f.id} className={`card given ${f.kind}`}>
              <span className="given-kind">{f.kind === 'plus' ? '＋' : '－'}</span>
              <span className="given-text">{f.text}{f.kind === 'minus' && f.resolved && <span className="muted small"> · handled</span>}</span>
              <button className="btn ghost small" aria-label={`Delete “${f.text}”`} onClick={() => void deleteFeedback(code, currentWeekId, f.id)}>✕</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
