export const freshCard = () => ({ flipped: false, answer: '', grade: null, hinted: false, retry: false, attempt: 0, attempts: [] });
export const sessionState = () => ({ index: 0, cards: {}, finished: false });
export function sessionReducer(state, action) {
  const card = state.cards[state.index] || freshCard();
  const update = next => ({ ...state, cards: { ...state.cards, [state.index]: next } });
  switch (action.type) {
    case 'go': return { ...state, index: action.index, finished: false };
    case 'flip': return update({ ...card, flipped: !card.flipped });
    case 'hint': return update({ ...card, hinted: true });
    case 'type': return update({ ...card, answer: action.value });
    case 'grade':
      if (card.grade) return state;
      return update({ ...card, grade: action.correct ? 'correct' : 'wrong', answer: action.answer, attempts: [...card.attempts, { correct: action.correct, hinted: card.hinted, retry: card.retry }] });
    case 'retry': return update({ ...freshCard(), retry: true, attempt: card.attempt + 1, attempts: card.attempts });
    case 'finish': return { ...state, finished: true };
    default: return state;
  }
}
