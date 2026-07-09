import { useSettings } from '../settings/store'

export type Lang = 'pt' | 'en'

const S = {
  'nav.home': { pt: 'Início', en: 'Home' },
  'nav.feed': { pt: 'Feed', en: 'Feed' },
  'nav.likes': { pt: 'Curtidas', en: 'Likes' },
  'nav.charts': { pt: 'Explorar', en: 'Explore' },
  'nav.playlists': { pt: 'Suas playlists', en: 'Your playlists' },
  'search.placeholder': { pt: 'O que quer ouvir?', en: 'What do you want to hear?' },
  'greet.dawn': { pt: 'Boa madrugada', en: 'Good night' },
  'greet.morning': { pt: 'Bom dia', en: 'Good morning' },
  'greet.afternoon': { pt: 'Boa tarde', en: 'Good afternoon' },
  'greet.evening': { pt: 'Boa noite', en: 'Good evening' },
  'home.recent': { pt: 'Recém reproduzido', en: 'Recently played' },
  'home.recentLocal': { pt: 'Tocados recentemente', en: 'Recently played' },
  'home.newTracks': { pt: 'Novas faixas', en: 'New tracks' },
  'home.suggestedArtists': { pt: 'Artistas para seguir', en: 'Artists to follow' },
  'common.loading': { pt: 'Carregando…', en: 'Loading…' },
  'common.retry': { pt: 'Tentar de novo', en: 'Try again' },
  'common.error': { pt: 'Algo deu errado.', en: 'Something went wrong.' },
  'likes.title': { pt: 'Curtidas', en: 'Likes' },
  'feed.title': { pt: 'Feed', en: 'Feed' },
  'coll.eyebrow': { pt: 'Coleção', en: 'Collection' },
  'coll.playlist': { pt: 'Playlist', en: 'Playlist' },
  'coll.artist': { pt: 'Artista', en: 'Artist' },
  'coll.tracks': { pt: 'faixas', en: 'tracks' },
  // settings
  'set.title': { pt: 'Configurações', en: 'Settings' },
  'set.appearance': { pt: 'Aparência', en: 'Appearance' },
  'set.zoom': { pt: 'Zoom da interface', en: 'Interface zoom' },
  'set.language': { pt: 'Idioma', en: 'Language' },
  'set.reduceMotion': { pt: 'Reduzir animações', en: 'Reduce motion' },
  'set.playback': { pt: 'Reprodução', en: 'Playback' },
  'set.streamPref': { pt: 'Qualidade do stream', en: 'Stream quality' },
  'set.streamProg': { pt: 'Progressivo (MP3)', en: 'Progressive (MP3)' },
  'set.streamHls': { pt: 'HLS', en: 'HLS' },
  'set.volume': { pt: 'Volume padrão', en: 'Default volume' },
  'set.notifications': { pt: 'Notificar ao trocar de faixa', en: 'Notify on track change' },
  'set.autoplay': { pt: 'Autoplay / rádio', en: 'Autoplay / radio' },
  'set.autoplayHint': { pt: 'Continuar com faixas relacionadas quando a fila acabar', en: 'Keep playing related tracks when the queue ends' },
  'set.integration': { pt: 'Sistema', en: 'System' },
  'set.discord': { pt: 'Presença no Discord', en: 'Discord presence' },
  'set.closeToTray': { pt: 'Fechar para a bandeja', en: 'Close to tray' },
  'set.startup': { pt: 'Abrir com o Windows', en: 'Start with Windows' },
  'set.data': { pt: 'Dados', en: 'Data' },
  'set.clearCache': { pt: 'Limpar cache de imagens e waveforms', en: 'Clear image & waveform cache' },
  'set.clearCacheBtn': { pt: 'Limpar', en: 'Clear' },
  'set.clearRecents': { pt: 'Limpar tocados recentemente', en: 'Clear recently played' },
  'set.logout': { pt: 'Sair da conta', en: 'Log out' },
  'set.about': { pt: 'Sobre', en: 'About' },
} as const

export type StringKey = keyof typeof S

export function translate(k: StringKey, lang: Lang): string {
  return S[k][lang]
}

export function useT(): (k: StringKey) => string {
  const lang = useSettings((s) => s.settings?.language ?? 'pt')
  return (k: StringKey) => translate(k, lang)
}
