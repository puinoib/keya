import { Routes, Route } from 'react-router-dom'
import { HelpLayout, HelpIndex, HelpPage } from './components'

export function HelpRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HelpLayout />}>
        <Route index element={<HelpIndex />} />
        <Route path=":slug" element={<HelpPage />} />
      </Route>
    </Routes>
  )
}
