let _enhance: string | null = null
export const setPendingEnhance = (ctx: string | null) => { _enhance = ctx }
export const takePendingEnhance = () => { const v = _enhance; _enhance = null; return v }

let _transcript: string | null = null
export const setPendingTranscript = (t: string | null) => { _transcript = t }
export const takePendingTranscript = () => { const v = _transcript; _transcript = null; return v }
