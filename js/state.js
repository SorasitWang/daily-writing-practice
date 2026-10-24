// Data shared by every module. Always read and assign through `state.x`
// so that every module sees the same values.
export const state = {
  entries: [],         // saved essays
  vocab: [],           // vocab notebook
  grammar: [],         // grammar notebook
  gstats: {},          // mistake counts: { 'YYYY-MM-DD': { '<category id>': count } }
  lastFeedback: null,  // coach feedback for the essay being edited
  currentEntryId: null // id of the essay being edited, or null for a new one
};
