import { createHashRouter } from 'react-router-dom'
import AppShell from './ui/AppShell'
import HomeView from './ui/views/HomeView'
import LikesView from './ui/views/LikesView'
import SearchView from './ui/views/SearchView'
import PlaylistView from './ui/views/PlaylistView'
import ArtistView from './ui/views/ArtistView'
import TrackView from './ui/views/TrackView'
import MixView from './ui/views/MixView'
import SettingsView from './ui/views/SettingsView'

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeView /> },
      { path: 'likes', element: <LikesView /> },
      { path: 'search', element: <SearchView /> },
      { path: 'playlist/:id', element: <PlaylistView /> },
      { path: 'artist/:id', element: <ArtistView /> },
      { path: 'track/:id', element: <TrackView /> },
      { path: 'mix', element: <MixView /> },
      { path: 'settings', element: <SettingsView /> },
    ],
  },
])
