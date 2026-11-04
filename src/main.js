import { mount } from 'svelte'
import 'leaflet/dist/leaflet.css'
import './app.css'
import App from './App.svelte'
import { mulaiPenyapu } from './lib/photos.js'

mulaiPenyapu()

export default mount(App, { target: document.getElementById('app') })
