export const MINUTE = 1000 * 60
export const within = (date: number, span: number) => Date.now() + span > date && date > Date.now() - span;
