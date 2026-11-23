import '@testing-library/jest-dom/vitest'

// API du navigateur absentes de jsdom (défilement)
window.scrollTo = () => {}
Element.prototype.scrollIntoView = () => {}
