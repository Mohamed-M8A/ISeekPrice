export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname;
  
  const match = host.match(/^(sa|ae|om|ma|dz|tn)\./i);
  
  if (match) {
    const country = match[1].toLowerCase();
    url.pathname = `/${country}${url.pathname}`;
    return context.env.ASSETS.fetch(url);
  }
  
  return context.next();
}
