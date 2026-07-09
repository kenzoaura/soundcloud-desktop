// SoundCloud's /mixed-selections returns canonical English titles; the web app
// localizes them client-side. We do the same for the common selections.
const EXACT: Record<string, string> = {
  // rail (selection) titles
  'More of what you like': 'Mais do que você gosta',
  'Recently Played': 'Recém reproduzido',
  'Albums for you': 'Álbuns para você',
  'Discover': 'Descobrir',
  'Discover with Stations': 'Descobrir com estações',
  'Liked By': 'Curtido por',
  'The Upload': 'The Upload',
  'Charts: Top 50': 'Paradas: Top 50',
  'Charts: New & hot': 'Paradas: Novas e quentes',
  'New from artists you follow': 'Novidades de quem você segue',
  'Made for you': 'Feito para você',
  'Your top tracks': 'Suas faixas favoritas',
  'Weekly': 'Semanal',
  // item (card) titles
  'Your Mix': 'Seu Mix',
  'Chill Mix': 'Mix relax',
  'On the Radar': 'No radar',
}

export function translateSelectionTitle(title: string): string {
  if (EXACT[title]) return EXACT[title]
  let m = title.match(/^Mixed for (.+)$/)
  if (m) return `Mixado para ${m[1]}`
  m = title.match(/^Related tracks:\s*(.+)$/)
  if (m) return `Faixas relacionadas: ${m[1]}`
  m = title.match(/^More like (.+)$/)
  if (m) return `Mais como ${m[1]}`
  m = title.match(/^Because you liked (.+)$/)
  if (m) return `Porque você curtiu ${m[1]}`
  m = title.match(/^Charts?:\s*(.+)$/)
  if (m) return `Paradas: ${m[1]}`
  m = title.match(/^Your Mix (\d+)$/)
  if (m) return `Seu Mix ${m[1]}`
  m = title.match(/^(.+)'s Picks$/)
  if (m) return `Seleções de ${m[1]}`
  m = title.match(/^Liked by (.+)$/)
  if (m) return `Curtido por ${m[1]}`
  return title
}
