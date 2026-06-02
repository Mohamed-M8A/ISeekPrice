export async function onRequest(context) {
  const url = new URL(context.request.url);
  const host = url.hostname;
  const supported = ['sa', 'ae', 'om', 'ma', 'dz', 'tn'];

  if (host === "www.iseekprice.com" || host === "iseekprice.com") {
    let countryCode = context.request.cf?.country?.toLowerCase() || 'sa';
    if (!supported.includes(countryCode)) {
      countryCode = 'sa';
    }
    const cleanPath = url.pathname.toLowerCase();
    return Response.redirect(`https://${countryCode}.iseekprice.com${cleanPath}${url.search}`, 301);
  }

  const match = host.match(/^(sa|ae|om|ma|dz|tn)\./i);
  if (match) {
    const country = match[1].toLowerCase();
    url.pathname = `/${country}${url.pathname}`;
    return context.env.ASSETS.fetch(url);
  }

  return context.next();
}
