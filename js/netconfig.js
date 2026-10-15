// Online play settings. The publishable key is meant to be public (it ships in every client).
// This currently points at the same Supabase project as the scooter game; only Realtime channels are used
// (no tables), so swapping to a dedicated project is just changing url + key here.
export const NET = {
  url: 'https://abandmjghllardztmfkf.supabase.co',
  key: 'sb_publishable__nAxY0gdDppFzBoYcTcvsw_jQCihPeC',
  protocol: 1,                       // bump when the netcode changes so old clients don't pair with new ones
  lobby: 'shankmaster-lobby-v1',
  searchSeconds: 20,                 // then fall back to an AI opponent
  sendHz: 20,
};
