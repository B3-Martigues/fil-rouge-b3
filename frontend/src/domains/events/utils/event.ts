/**Verifie si un événément est à venir */
export function isUpcomingEvent(date: string): boolean {
    return new Date(date) >= new Date();
}