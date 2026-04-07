type SortableCountertopOption = {
  title?: string;
  isAvailable?: boolean;
};

export const sortCountertopOptionsByAvailability = <T extends SortableCountertopOption>(options: T[]): T[] =>
  [...options].sort((a, b) => {
    const aAvailable = a.isAvailable !== false;
    const bAvailable = b.isAvailable !== false;
    if (aAvailable !== bAvailable) return aAvailable ? -1 : 1;
    return (a.title ?? "").localeCompare(b.title ?? "");
  });
