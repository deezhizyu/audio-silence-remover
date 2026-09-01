import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'

// Restore the path public/404.html stashed before redirecting here, so a hard refresh or a shared
// link to a specific page (which GitHub Pages can't serve directly, having no server-side routing)
// still lands the router on the right page instead of always resetting to "/".
const redirectPath = sessionStorage.getItem('redirectPath')
if (redirectPath) {
  sessionStorage.removeItem('redirectPath')
  history.replaceState(null, '', redirectPath)
}

render(<App />, document.getElementById('app')!)
