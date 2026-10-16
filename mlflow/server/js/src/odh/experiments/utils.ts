export const isExpId = (id: string | undefined): id is string => Boolean(id && /^\d+$/.test(id));
