export function offsetFor(page, size) {
  return (page - 1) * size;
}

export function sliceFor(list, page, size) {
  const start = offsetFor(page, size);
  return list.slice(start, start + size);
}

export function totalPages(count, size) {
  return Math.ceil(count / size);
}

function pageHref(page, rawQuery) {
  const queryPart = rawQuery === null ? '' : `&q=${encodeURIComponent(rawQuery)}`;
  return `?page=${page}${queryPart}`;
}

export function paginationLinks(page, total, rawQuery) {
  if (total <= 1) return null;
  return {
    page,
    total,
    prevHref: page > 1 ? pageHref(page - 1, rawQuery) : null,
    nextHref: page < total ? pageHref(page + 1, rawQuery) : null,
  };
}
