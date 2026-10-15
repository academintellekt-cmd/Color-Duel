// Pure rules for the Color-Duel duel lobby: which settings a mode has, defaults
// and start readiness. Mirrors the old modes -> difficulty -> duration flow.
// Loaded as a plain <script> (global LobbyOptions) and required by tests.
(function(root){
  const LOBBY_MODES=['combination','rhythm','pingPong','colorRing'];
  const DIFFICULTIES={combination:['easy','medium','hard','extreme'],rhythm:['easy','medium','hard','extreme'],pingPong:['easy','medium','hard','extreme'],colorRing:['easy','medium','hard']};
  function modeOptions(mode,durations){return{difficulties:[...(DIFFICULTIES[mode]||[])],durations:[...(durations||[])].map(Number).sort((a,b)=>a-b)}}
  function defaultSelection(mode,durations){const o=modeOptions(mode,durations);return{mode,variant:null,difficulty:o.difficulties[0]??null,durationMinutes:o.durations[0]??1}}
  function canStart(selection,players,max,session){if(session)return{ok:true,reason:null};if((players||[]).length<max)return{ok:false,reason:'needPlayers'};return{ok:true,reason:null}}
  function selectionLabel(selection,names){const parts=[names.modes[selection.mode]];if(selection.difficulty)parts.push(names.difficulties[selection.difficulty]);parts.push(`${selection.durationMinutes} ${names.minute}`);return parts.join(' · ')}
  const api={LOBBY_MODES,modeOptions,defaultSelection,canStart,selectionLabel};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LobbyOptions=api;
})(typeof window!=='undefined'?window:globalThis);
